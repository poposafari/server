import { Request, Response } from "express";
import { HttpError } from "../share/http-error";
import { IngameService } from "../services/ingame.service";

export class IngameController {
  static async register(req: Request, res: Response): Promise<any> {
    try {
      const newGameAccount = await IngameService.register(
        req.body,
        req.cookies.access_token
      );
      return res.status(201).json(newGameAccount);
    } catch (err: any) {
      if (err instanceof HttpError) {
        return res.status(err.getStatus()).json({ error: err.message });
      } else {
        return res.status(500).json({ error: err.message });
      }
    }
  }

  static async getUserData(req: Request, res: Response): Promise<any> {
    try {
      const userData = await IngameService.getUserData(res.locals.user.id);
      return res.status(201).json(userData);
    } catch (err: any) {
      if (err instanceof HttpError) {
        return res.status(err.getStatus()).json({ error: err.message });
      } else {
        return res.status(500).json({ error: err.message });
      }
    }
  }

  static async updateItemSlot(req: Request, res: Response): Promise<any> {
    try {
      const updatedItemSlot = await IngameService.updateItemSlot(
        res.locals.user.id,
        req.body
      );
      return res.status(201).json(updatedItemSlot);
    } catch (err: any) {
      if (err instanceof HttpError) {
        return res.status(err.getStatus()).json({ error: err.message });
      } else {
        return res.status(500).json({ error: err.message });
      }
    }
  }
}
