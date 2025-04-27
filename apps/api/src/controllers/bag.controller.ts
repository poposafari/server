import { Request, Response } from "express";
import { BagService } from "../services/bag.service";

export class BagController {
  static async addItem(req: Request, res: Response): Promise<any> {
    try {
      const ret = await BagService.addItem(res.locals.user.id, req.body);
      return res.status(201).json(ret);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  static async useItem(req: Request, res: Response): Promise<any> {
    try {
      const ret = await BagService.useItem(res.locals.user.id, req.body);
      return res.status(201).json(ret);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  static async getItems(req: Request, res: Response): Promise<any> {
    try {
      const ret = await BagService.getItems(res.locals.user.id, req.body);
      return res.status(200).json(ret);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  static async getAllItems(req: Request, res: Response): Promise<any> {
    try {
      const ret = await BagService.getAllItems(res.locals.user.id);
      return res.status(200).json(ret);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  static async buyItem(req: Request, res: Response): Promise<any> {
    try {
      const ret = await BagService.buyItem(res.locals.user.id, req.body);
      return res.status(200).json(ret);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
}
