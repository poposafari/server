import { FastifyInstance } from 'fastify';
import { sessionAuthGuard } from '../../hooks/session-auth.hook';
import { zodValidate } from '../../hooks/validate.hook';
import {
  itemParamsSchema,
  sellItemSchema,
  buyItemSchema,
  heldItemParamsSchema,
  giveHoldSchema,
  updateItemSchema,
} from './item.schema';
import { ItemController } from './item.controller';
import { ItemService } from './item.service';
import { ItemRepository } from './item.repository';

export default async function itemRoutes(app: FastifyInstance) {
  const repo = new ItemRepository();
  const service = new ItemService(repo);
  const controller = new ItemController(service);

  app.get('/users/me/items', {
    preHandler: [sessionAuthGuard],
    handler: controller.getBag,
  });

  app.get('/users/me/safari-ticket', {
    preHandler: [sessionAuthGuard],
    handler: controller.getSafariTicketStatus,
  });

  app.post('/users/me/safari-ticket/claim', {
    preHandler: [sessionAuthGuard],
    handler: controller.claimSafariTicket,
  });

  app.post('/users/me/items/:itemId/buy', {
    preHandler: [sessionAuthGuard, zodValidate({ params: itemParamsSchema, body: buyItemSchema })],
    handler: controller.buy,
  });

  app.post('/users/me/items/:itemId/sell', {
    preHandler: [sessionAuthGuard, zodValidate({ params: itemParamsSchema, body: sellItemSchema })],
    handler: controller.sell,
  });

  app.put('/users/me/pokemons/:id/held-item', {
    preHandler: [
      sessionAuthGuard,
      zodValidate({ params: heldItemParamsSchema, body: giveHoldSchema }),
    ],
    handler: controller.giveHold,
  });

  app.delete('/users/me/pokemons/:id/held-item', {
    preHandler: [sessionAuthGuard, zodValidate({ params: heldItemParamsSchema })],
    handler: controller.takeHold,
  });

  app.patch('/users/me/items/:itemId', {
    preHandler: [
      sessionAuthGuard,
      zodValidate({ params: itemParamsSchema, body: updateItemSchema }),
    ],
    handler: controller.update,
  });
}
