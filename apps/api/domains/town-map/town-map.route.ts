import { Router } from 'express';
import { sessionAuthGuard } from '../../hooks/session-auth.hook';
import { TownMapController } from './town-map.controller';
import { TownMapService } from './town-map.service';
import { TownMapRepository } from './town-map.repository';

const router = Router();

const repo = new TownMapRepository();
const service = new TownMapService(repo);
const controller = new TownMapController(service);

router.get('/users/me/visited-maps', sessionAuthGuard, controller.getAll);

export default router;
