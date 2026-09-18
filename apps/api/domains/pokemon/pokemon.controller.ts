import { Request, Response } from 'express';
import { AuditAction } from '@poposerver/lib/types';
import { PokemonService } from './pokemon.service';
import { PokemonParams } from './pokemon.schema';

export class PokemonController {
  constructor(private readonly pokemonService: PokemonService) {}

  getBox = async (req: Request, res: Response) => {
    const data = await this.pokemonService.getBox(req.authId);
    return res.status(200).json({ success: true, data });
  };

  getBoxMeta = async (req: Request, res: Response) => {
    const data = await this.pokemonService.getBoxMeta(req.authId);
    return res.status(200).json({ success: true, data });
  };

  evolve = async (req: Request, res: Response) => {
    const { id } = req.params as unknown as PokemonParams;
    const { cost } = req.body as { cost: string };
    const data = await this.pokemonService.evolve(req.authId, { id, cost }, req.ip);
    return res.status(200).json({ success: true, data });
  };

  upgrade = async (req: Request, res: Response) => {
    const { id } = req.params as unknown as PokemonParams;
    const data = await this.pokemonService.upgrade(req.authId, { id }, req.ip);
    return res.status(200).json({ success: true, data });
  };

  sell = async (req: Request, res: Response) => {
    const body = req.body as { ids: number[] };
    const data = await this.pokemonService.sell(req.authId, body, req.ip);
    return res.status(200).json({ success: true, data });
  };

  arrange = async (req: Request, res: Response) => {
    const body = req.body as {
      changes: {
        id: number;
        boxNumber: number | null;
        gridNumber: number | null;
        partySlot: number | null;
      }[];
      boxMeta?: {
        boxNumber: number;
        wallpaper: number;
        name: string;
      }[];
      nicknames?: {
        id: number;
        nickname: string | null;
      }[];
    };
    const summary = await this.pokemonService.arrange(req.authId, body);
    if (summary.changed) {
      req.audit = {
        action: AuditAction.POKEMON_ARRANGE,
        detail: {
          changeCount: body.changes.length,
          movedCount: summary.movedCount,
          boxMetaCount: summary.boxMetaCount,
          nicknameChangedCount: summary.nicknameChangedCount,
        },
      };
    }
    return res.status(200).json({ success: true });
  };

  enhance = async (req: Request, res: Response) => {
    const { id } = req.params as unknown as PokemonParams;
    const { candies } = req.body as { candies: { itemId: string; count: number }[] };
    const data = await this.pokemonService.enhance(req.authId, { id, candies }, req.ip);
    return res.status(200).json({ success: true, data });
  };

  learnMove = async (req: Request, res: Response) => {
    const { id } = req.params as unknown as PokemonParams;
    const { move } = req.body as { move: string };
    const data = await this.pokemonService.learnMove(req.authId, { id, move }, req.ip);
    return res.status(201).json({ success: true, data });
  };
}
