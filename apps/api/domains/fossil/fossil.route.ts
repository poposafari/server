import { Router } from 'express';
import { sessionAuthGuard } from '../../hooks/session-auth.hook';
import { zodValidate } from '../../hooks/validate.hook';
import { restoreFossilParamsSchema } from './fossil.schema';
import { FossilController } from './fossil.controller';
import { FossilService } from './fossil.service';

const router = Router();

const service = new FossilService();
const controller = new FossilController(service);

router.post(
  '/users/me/fossils/:fossilId/restore',
  sessionAuthGuard,
  zodValidate({ params: restoreFossilParamsSchema }),
  controller.restore,
);

export default router;
