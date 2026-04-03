import { FastifyInstance } from 'fastify';
import { sessionAuthGuard } from '../../hooks/session-auth.hook';
import { zodValidate } from '../../hooks/validate.hook';
import { GameController } from './game.controller';
import { GameService } from './game.service';
import { SafariController } from './safari.controller';
import { SafariService } from './safari.service';
import { enterSafariSchema, pickItemSchema, catchWildSchema } from './safari.schema';

export default async function gameRoutes(app: FastifyInstance) {
  const service = new GameService();
  const controller = new GameController(service);

  app.post('/connect', {
    preHandler: [sessionAuthGuard],
    handler: controller.connect,
  });

  const safariService = new SafariService();
  const safariController = new SafariController(safariService);

  app.post('/safari/enter', {
    preHandler: [sessionAuthGuard, zodValidate(enterSafariSchema)],
    handler: safariController.enter,
  });

  app.post('/safari/pick-item', {
    preHandler: [sessionAuthGuard, zodValidate(pickItemSchema)],
    handler: safariController.pickItem,
  });

  app.post('/safari/catch', {
    preHandler: [sessionAuthGuard, zodValidate(catchWildSchema)],
    handler: safariController.catchWild,
  });

  app.post('/safari/exit', {
    preHandler: [sessionAuthGuard],
    handler: safariController.exit,
  });
}
