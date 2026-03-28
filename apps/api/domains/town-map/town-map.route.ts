import { FastifyInstance } from 'fastify';
import { sessionAuthGuard } from '../../hooks/session-auth.hook';
import { TownMapController } from './town-map.controller';
import { TownMapService } from './town-map.service';
import { TownMapRepository } from './town-map.repository';

export default async function townMapRoutes(app: FastifyInstance) {
  const repo = new TownMapRepository();
  const service = new TownMapService(repo);
  const controller = new TownMapController(service);

  app.get('/', {
    preHandler: [sessionAuthGuard],
    handler: controller.getAll,
  });
}
