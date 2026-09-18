import { Router } from 'express';
import { sessionAuthGuard } from '../../hooks/session-auth.hook';
import { zodValidate } from '../../hooks/validate.hook';
import {
  buyItemSchema,
  giveHoldSchema,
  heldItemParamsSchema,
  itemParamsSchema,
  sellItemSchema,
  updateItemSchema,
} from './item.schema';
import { ItemController } from './item.controller';
import { ItemService } from './item.service';
import { ItemRepository } from './item.repository';

const router = Router();

const repo = new ItemRepository();
const service = new ItemService(repo);
const controller = new ItemController(service);

router.get('/users/me/items', sessionAuthGuard, controller.getBag);

router.get('/users/me/safari-ticket', sessionAuthGuard, controller.getSafariTicketStatus);

router.post('/users/me/safari-ticket/claim', sessionAuthGuard, controller.claimSafariTicket);

router.post(
  '/users/me/items/:itemId/buy',
  sessionAuthGuard,
  zodValidate({ params: itemParamsSchema, body: buyItemSchema }),
  controller.buy,
);

router.post(
  '/users/me/items/:itemId/sell',
  sessionAuthGuard,
  zodValidate({ params: itemParamsSchema, body: sellItemSchema }),
  controller.sell,
);

router.put(
  '/users/me/pokemons/:id/held-item',
  sessionAuthGuard,
  zodValidate({ params: heldItemParamsSchema, body: giveHoldSchema }),
  controller.giveHold,
);

router.delete(
  '/users/me/pokemons/:id/held-item',
  sessionAuthGuard,
  zodValidate({ params: heldItemParamsSchema }),
  controller.takeHold,
);

router.patch(
  '/users/me/items/:itemId',
  sessionAuthGuard,
  zodValidate({ params: itemParamsSchema, body: updateItemSchema }),
  controller.update,
);

export default router;
