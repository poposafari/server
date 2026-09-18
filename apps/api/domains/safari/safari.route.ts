import { Router } from 'express';
import { sessionAuthGuard } from '../../hooks/session-auth.hook';
import { zodValidate } from '../../hooks/validate.hook';
import { SafariController } from './safari.controller';
import { SafariService } from './safari.service';
import { enterSafariSchema, safariTargetParamsSchema } from './safari.schema';

const router = Router();

const service = new SafariService();
const controller = new SafariController(service);

router.post(
  '/safari/enter',
  sessionAuthGuard,
  zodValidate({ body: enterSafariSchema }),
  controller.enter,
);

router.post(
  '/safari/items/:uid/pick',
  sessionAuthGuard,
  zodValidate({ params: safariTargetParamsSchema }),
  controller.pickItem,
);

router.post(
  '/safari/wilds/:uid/catch',
  sessionAuthGuard,
  zodValidate({ params: safariTargetParamsSchema }),
  controller.catchWild,
);

router.post(
  '/safari/wilds/:uid/bait',
  sessionAuthGuard,
  zodValidate({ params: safariTargetParamsSchema }),
  controller.baitWild,
);

router.post(
  '/safari/wilds/:uid/rock',
  sessionAuthGuard,
  zodValidate({ params: safariTargetParamsSchema }),
  controller.rockWild,
);

router.post('/safari/exit', sessionAuthGuard, controller.exit);

export default router;
