import { FastifyInstance } from 'fastify';
import { sessionAuthGuard } from '../../hooks/session-auth.hook';
import { zodValidate } from '../../hooks/validate.hook';
import {
  sellItemSchema,
  buyItemSchema,
  giveHoldSchema,
  takeHoldSchema,
  registerItemSchema,
  unregisterItemSchema,
} from './item.schema';
import { ItemController } from './item.controller';
import { ItemService } from './item.service';
import { ItemRepository } from './item.repository';

export default async function itemRoutes(app: FastifyInstance) {
  const repo = new ItemRepository();
  const service = new ItemService(repo);
  const controller = new ItemController(service);

  app.get('/bag', {
    preHandler: [sessionAuthGuard],
    handler: controller.getBag,
  });

  app.get('/safari-ticket', {
    preHandler: [sessionAuthGuard],
    handler: controller.getSafariTicketStatus,
  });

  app.post('/safari-ticket/claim', {
    preHandler: [sessionAuthGuard],
    handler: controller.claimSafariTicket,
  });

  app.post('/buy', {
    preHandler: [sessionAuthGuard, zodValidate(buyItemSchema)],
    handler: controller.buy,
  });

  app.post('/sell', {
    preHandler: [sessionAuthGuard, zodValidate(sellItemSchema)],
    handler: controller.sell,
  });

  app.post('/give-hold', {
    preHandler: [sessionAuthGuard, zodValidate(giveHoldSchema)],
    handler: controller.giveHold,
  });

  app.post('/take-hold', {
    preHandler: [sessionAuthGuard, zodValidate(takeHoldSchema)],
    handler: controller.takeHold,
  });

  app.post('/register', {
    preHandler: [sessionAuthGuard, zodValidate(registerItemSchema)],
    handler: controller.register,
  });

  app.post('/unregister', {
    preHandler: [sessionAuthGuard, zodValidate(unregisterItemSchema)],
    handler: controller.unregister,
  });
}
