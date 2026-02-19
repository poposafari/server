import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from 'apps/api/middlewares/jwt.middleware';
import { GameService } from './game.service';
import { CatchStartingPokemonRes, GetStartingListRes, SelectStartingDto } from './game.dto';
import { logger } from '@poposerver/shared';

export class GameController {
  constructor(private readonly gameService: GameService) {}

  /** GET 스타팅 포켓몬 30마리 목록 (isNewbie만 가능, DB 미저장) */
  getStartingPokemonList = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const authId = authReq.user!.authId;

      const list = await this.gameService.getStartingList(authId);
      const body: GetStartingListRes = { list };

      res.status(200).json({ success: true, data: body });
    } catch (error) {
      next(error);
    }
  };

  /** POST 스타팅 포켓몬 선택 (선택한 1마리만 PC에 저장). body는 selectStartingSchema로 검증됨. */
  catchStartingPokemon = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const authId = authReq.user!.authId;
      const { index } = req.body as SelectStartingDto;

      logger.debug(`Select Starting Pokemon attempt: authId=${authId}, index=${index}`);

      const pokemon = await this.gameService.catchStartingPokemon(authId, index);
      const { authId: _omit, auth: _omit2, ...data } = pokemon;
      const body: CatchStartingPokemonRes = data;

      res.status(201).json({ success: true, data: body });
    } catch (error) {
      next(error);
    }
  };
}
