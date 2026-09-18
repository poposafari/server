import { Request, Response } from 'express';
import { TownMapService } from './town-map.service';

export class TownMapController {
  constructor(private readonly townMapService: TownMapService) {}

  getAll = async (req: Request, res: Response) => {
    const data = await this.townMapService.getAll(req.authId);
    return res.status(200).json({ success: true, data });
  };
}
