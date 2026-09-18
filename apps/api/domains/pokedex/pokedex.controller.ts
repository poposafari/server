import { Request, Response } from 'express';
import { PokedexService } from './pokedex.service';

export class PokedexController {
  constructor(private readonly pokedexService: PokedexService) {}

  getAll = async (req: Request, res: Response) => {
    const data = await this.pokedexService.getAll(req.authId);
    return res.status(200).json({ success: true, data });
  };
}
