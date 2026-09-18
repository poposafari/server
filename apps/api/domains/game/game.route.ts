import { Router } from 'express';
import { sessionAuthGuard } from '../../hooks/session-auth.hook';
import { GameController } from './game.controller';
import { GameService } from './game.service';

const router = Router();

const service = new GameService();
const controller = new GameController(service);

router.post('/game/connections', sessionAuthGuard, controller.connect);

router.get('/game/online-count', sessionAuthGuard, controller.getOnlineCount);

export default router;
