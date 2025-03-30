import { Request, Response } from "express";
import { AccountService } from "../services/account.service";
import { HttpError } from "../share/http-error";
import { createAccessToken } from "../share/jwt";

export class AccountController {
  static async register(req: Request, res: Response): Promise<any> {
    try {
      const newAccount = await AccountService.register(req.body);

      const accessToken = createAccessToken({
        id: newAccount.id,
      });

      return res
        .cookie("access_token", accessToken, {
          httpOnly: true,
          secure: true,
          sameSite: "none",
          maxAge: 1000 * 60 * 15,
        })
        .status(201)
        .json({ access_token: accessToken });

      return res.status(201).json(newAccount.username);
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

      return res
        .cookie("access_token", accessToken, {
          httpOnly: true,
          secure: true,
          sameSite: "lax",
          maxAge: 1000 * 60 * 15,
        })
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
}
