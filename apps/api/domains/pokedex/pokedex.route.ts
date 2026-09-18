import { Router } from 'express';
import { sessionAuthGuard } from '../../hooks/session-auth.hook';
import { PokedexController } from './pokedex.controller';
import { PokedexService } from './pokedex.service';
import { PokedexRepository } from './pokedex.repository';

const router = Router();

const repo = new PokedexRepository();
const service = new PokedexService(repo);
const controller = new PokedexController(service);

router.get('/users/me/pokedex', sessionAuthGuard, controller.getAll);

export default router;
