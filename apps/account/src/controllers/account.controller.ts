import { Request, Response } from "express";
import { AccountService } from "../services/account.service";
import { HttpError } from "../share/http-error";
import { createAccessToken } from "../share/jwt";
import { createRefreshToken } from "../share/jwt";
import { redis } from "../db/redis-source";
import { CookieConfig } from "../share/options";

export class AccountController {
  static async register(req: Request, res: Response): Promise<any> {
    try {
      const newAccount = await AccountService.register(req.body);

      const accessToken = createAccessToken({
        id: newAccount.id,
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
}
