import { Request, Response } from "express";
import { SafariService } from "../services/safari.service";
import { HttpError } from "../utils/http-error";

export class SafariController {
  static async useTicket(req: Request, res: Response): Promise<any> {
    try {
      const ret = await SafariService.useTicket(res.locals.user.id, req.body);
      return res.status(200).json(ret);
    } catch (err: any) {
      if (err instanceof HttpError) {
        return res.status(err.getStatus()).json({ error: err.message });
      } else {
        return res.status(500).json({ error: err.message });
      }
    }
  }
}
