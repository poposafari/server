import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { UnauthorizedHttpError } from "./http-error";
import { createAccessToken, verifyAccessToken } from "./jwt";
import { redis } from "../redis-source";
import { CookieConfig } from "./options";

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const token =
    req.cookies.access_token || req.headers.authorization?.split(" ")[1];

  if (!token) {
    return next(new UnauthorizedHttpError("Unauthorized token"));
  }

  try {
    const payload = verifyAccessToken(token) as any;
    res.locals.user = payload;
    res.locals.token = token;
    return next();
  } catch (err) {
    try {
      const payload = jwt.decode(token) as any;

      if (!payload || !payload.id) {
        return next(new UnauthorizedHttpError("Invalid token"));
      }

      const refreshToken = await redis.get(`refresh:${payload.id}`);
      if (!refreshToken) {
        return next(
          new UnauthorizedHttpError("Session expired, please login again")
        );
      }

      const newAccessToken = createAccessToken({ id: payload.id });
      res.cookie("access_token", newAccessToken, CookieConfig as any);
      res.locals.user = payload;
      res.locals.token = token;

      return next();
    } catch (err: any) {
      return next(new UnauthorizedHttpError("Token refresh failed"));
    }
  }
};
