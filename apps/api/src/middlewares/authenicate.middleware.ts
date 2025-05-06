import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { createAccessToken, verifyAccessToken, verifyRefreshToken } from "../utils/jwt";
import { CookieConfig } from "../utils/options";
import {
  InvalidRefreshTokenHttpError,
  InvalidTokenHttpError,
  NotFoundToken,
  SessionExpiredHttpError,
} from "../utils/http-error";
import { redis } from "../data-source";

export const Authenticate = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies.access_token || req.headers.authorization?.split(" ")[1];

  if (!token) {
    return next(new NotFoundToken());
  }

  try {
    const payload = verifyAccessToken(token) as any;
    res.locals.user = payload;

    return next();
  } catch (err) {
    try {
      const payload = jwt.decode(token) as any;

      if (!payload || !payload.id) {
        return next(new InvalidTokenHttpError());
      }

      const refreshToken = await redis.get(`refresh:${payload.id}`);
      if (!refreshToken) return next(new SessionExpiredHttpError());

      verifyRefreshToken(refreshToken);
      const newAccessToken = createAccessToken({ id: payload.id });

      res.cookie("access_token", newAccessToken, CookieConfig as any);
      res.locals.user = payload;

      return next();
    } catch (err: any) {
      return next(new InvalidRefreshTokenHttpError("Token refresh failed"));
    }
  }
};
