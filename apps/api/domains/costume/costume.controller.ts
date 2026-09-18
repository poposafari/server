import { Request, Response } from 'express';
import { CostumeService } from './costume.service';

export class CostumeController {
  constructor(private readonly costumeService: CostumeService) {}

  getAll = async (req: Request, res: Response) => {
    const data = await this.costumeService.getAll(req.authId);
    return res.status(200).json({ success: true, data });
  };
}
