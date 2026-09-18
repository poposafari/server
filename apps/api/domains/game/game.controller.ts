import { Request, Response } from 'express';
import { GameService } from './game.service';

export class GameController {
  constructor(private readonly service: GameService) {}

  connect = async (req: Request, res: Response) => {
    const authId = req.authId!;
    const result = await this.service.connect(authId);
    return res.status(200).json({ success: true, data: result });
  };

  getOnlineCount = async (_req: Request, res: Response) => {
    const count = await this.service.getOnlineCount();
    return res.status(200).json({ success: true, data: { count } });
  };
}
