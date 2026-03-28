import { FastifyInstance } from 'fastify';
import { sessionAuthGuard } from '../../hooks/session-auth.hook';
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
}
