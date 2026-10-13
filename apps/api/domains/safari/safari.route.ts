import { Router } from 'express';
import { sessionAuthGuard } from '../../hooks/session-auth.hook';
import { zodValidate } from '../../hooks/validate.hook';
import { SafariController } from './safari.controller';
import { SafariService } from './safari.service';
import {
  catchWildSchema,
  enterSafariSchema,
  feedWildSchema,
  safariTargetParamsSchema,
  useItemWildSchema,
} from './safari.schema';

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
  zodValidate({ params: safariTargetParamsSchema, body: catchWildSchema }),
  controller.catchWild,
);

router.post(
  '/safari/wilds/:uid/feed',
  sessionAuthGuard,
  zodValidate({ params: safariTargetParamsSchema, body: feedWildSchema }),
  controller.feedWild,
);

router.post(
  '/safari/wilds/:uid/use',
  sessionAuthGuard,
  zodValidate({ params: safariTargetParamsSchema, body: useItemWildSchema }),
  controller.useItemWild,
);

router.post('/safari/exit', sessionAuthGuard, controller.exit);

export default router;
