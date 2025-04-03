import { Request, Response } from "express";
import { AccountService } from "../services/account.service";
import { HttpError } from "../share/http-error";
import { createAccessToken } from "../share/jwt";
import { createRefreshToken } from "../share/jwt";
import { redis } from "../db/redis-source";
import { CookieConfig } from "../share/options";
import { verifyAccessToken } from "../share/jwt";
import { UnauthorizedHttpError } from "../share/http-error";

export class AccountController {
  static async register(req: Request, res: Response): Promise<any> {
    try {
      const newAccount = await AccountService.register(req.body);

      const accessToken = createAccessToken({
        id: newAccount.id,
      });

      const refreshToken = createRefreshToken({
        id: newAccount.id,
      });

      await redis.set(`refresh:${newAccount.id}`, refreshToken, {
        EX: 60 * 60 * 24 * 7,
      });

      return res
        .cookie("access_token", accessToken, CookieConfig as any)
        .status(201)
        .json({ access_token: accessToken });
    } catch (err: any) {
      if (err instanceof HttpError) {
        return res.status(err.getStatus()).json({ error: err.message });
      } else {
        return res.status(500).json({ error: err.message });
      }
    }
  }

  static async login(req: Request, res: Response): Promise<any> {
    try {
      const hasAccount = await AccountService.login(req.body);

      const accessToken = createAccessToken({
        id: hasAccount.id,
      });

      const refreshToken = createRefreshToken({
        id: hasAccount.id,
      });

      await redis.set(`refresh:${hasAccount.id}`, refreshToken, {
        EX: 60 * 60 * 24 * 7,
      });

      return res
        .cookie("access_token", accessToken, CookieConfig as any)
        .status(201)
        .json({ access_token: accessToken });
    } catch (err: any) {
      if (err instanceof HttpError) {
        return res.status(err.getStatus()).json({ error: err.message });
      } else {
        return res.status(500).json({ error: err.message });
      }
    }
  }

  static async autoLogin(req: Request, res: Response): Promise<any> {
    return res.status(201).json(true);
  }

  static async logout(req: Request, res: Response): Promise<any> {
    try {
      const tokenPayload = verifyAccessToken(
        req.cookies.access_token || req.headers.authorization?.split(" ")[1]
      );

      if (
        !tokenPayload ||
        typeof tokenPayload === "string" ||
        !tokenPayload.id
      ) {
        throw new UnauthorizedHttpError("Unauthorized token");
      }

      await redis.del(`refresh:${tokenPayload.id}`);
      return res
        .clearCookie("access_token", CookieConfig as any)
        .status(201)
        .json(true);
    } catch (err: any) {
      if (err instanceof HttpError) {
        return res.status(err.getStatus()).json({ error: err.message });
      } else {
        return res.status(500).json({ error: err.message });
      }
    }
  }

  static async deleteAccount(req: Request, res: Response): Promise<any> {
    try {
      const userData = await AccountService.deleteAccount(res.locals.user.id);
      return res.status(201).json(userData);
    } catch (err: any) {
      if (err instanceof HttpError) {
        return res.status(err.getStatus()).json({ error: err.message });
      } else {
        return res.status(500).json({ error: err.message });
      }
    }
  }
}
