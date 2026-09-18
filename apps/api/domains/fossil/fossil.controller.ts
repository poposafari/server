import { Request, Response } from 'express';
import { FossilService } from './fossil.service';
import { RestoreFossilParams } from './fossil.schema';

export class FossilController {
  constructor(private readonly fossilService: FossilService) {}

  restore = async (req: Request, res: Response) => {
    const { fossilId } = req.params as unknown as RestoreFossilParams;
    const data = await this.fossilService.restore(req.authId, fossilId, req.ip);
    return res.status(201).json({ success: true, data });
  };
}
