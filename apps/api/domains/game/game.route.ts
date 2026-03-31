import { FastifyInstance } from 'fastify';
import { sessionAuthGuard } from '../../hooks/session-auth.hook';
import { GameController } from './game.controller';
import { GameService } from './game.service';

export default async function gameRoutes(app: FastifyInstance) {
  const service = new GameService();
  const controller = new GameController(service);

  app.post('/connect', {
    preHandler: [sessionAuthGuard],
    handler: controller.connect,
  });
}
