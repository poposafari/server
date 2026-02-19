import { Router } from 'express';
import { AppDataSource, User, UserBag, UserPokemon, validate } from '@poposerver/shared';
import { PcRepository } from '../pc/pc.repository';
import { PcService } from '../pc/pc.service';
import { BagRepository } from '../bag/bag.repository';
import { BagService } from '../bag/bag.service';
import { UserRepository } from '../user/user.repository';
import { GameService } from './game.service';
import { GameController } from './game.controller';
import { jwtAuthGuard } from 'apps/api/middlewares';
import { catchStartingSchema } from './game.schema';

const router = Router();

const pcRepository = new PcRepository(AppDataSource.getRepository(UserPokemon));
const pcService = new PcService(AppDataSource, pcRepository);
const bagRepository = new BagRepository(AppDataSource.getRepository(UserBag));
const bagService = new BagService(AppDataSource, bagRepository);
const userRepository = new UserRepository(AppDataSource.getRepository(User));
const gameService = new GameService(AppDataSource, pcService, bagService, userRepository);
const gameController = new GameController(gameService);

router.get('/starting', jwtAuthGuard, gameController.getStartingPokemonList);
router.post(
  '/starting/catch',
  validate(catchStartingSchema),
  jwtAuthGuard,
  gameController.catchStartingPokemon,
);

export default router;
