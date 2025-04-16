import { Request, Response } from "express";
import { PokeboxService } from "../services/pokebox.service";
import { HttpError } from "../utils/http-error";

export class PokeboxController {
  static async addPokemon(req: Request, res: Response): Promise<any> {
    try {
      const newPokemon = await PokeboxService.addPokemon(
        res.locals.user.id,
        req.body
      );

      return res.status(201).json(newPokemon);
    } catch (err: any) {
      if (err instanceof HttpError) {
        return res.status(err.getStatus()).json({ error: err.message });
      } else {
        return res.status(500).json({ error: err.message });
      }
    }
  }
}
