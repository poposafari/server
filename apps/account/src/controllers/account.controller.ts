import { Request, Response } from "express";
import { AccountService } from "../services/account.service";
import { HttpError } from "../share/http-error";

export class AccountController {
  static async register(req: Request, res: Response): Promise<any> {
    try {
      const newAccount = await AccountService.register(req.body);
      return res.status(201).json(newAccount);
    } catch (err: any) {
      if (err instanceof HttpError) {
        return res.status(err.getStatus()).json({ error: err.message });
      } else {
        return res.status(500).json({ error: err.message });
      }
    }
  }
}
