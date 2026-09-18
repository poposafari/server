import { FastifyInstance } from 'fastify';
import { sessionAuthGuard } from '../../hooks/session-auth.hook';
import { zodValidate } from '../../hooks/validate.hook';
import { SafariController } from './safari.controller';
import { SafariService } from './safari.service';
import { enterSafariSchema, safariTargetParamsSchema } from './safari.schema';

export default async function safariRoutes(app: FastifyInstance) {
  const service = new SafariService();
  const controller = new SafariController(service);

  app.post('/safari/enter', {
    preHandler: [sessionAuthGuard, zodValidate({ body: enterSafariSchema })],
    handler: controller.enter,
  });

  app.post('/safari/items/:uid/pick', {
    preHandler: [sessionAuthGuard, zodValidate({ params: safariTargetParamsSchema })],
    handler: controller.pickItem,
  });

  app.post('/safari/wilds/:uid/catch', {
    preHandler: [sessionAuthGuard, zodValidate({ params: safariTargetParamsSchema })],
    handler: controller.catchWild,
  });

  app.post('/safari/wilds/:uid/bait', {
    preHandler: [sessionAuthGuard, zodValidate({ params: safariTargetParamsSchema })],
    handler: controller.baitWild,
  });

  app.post('/safari/wilds/:uid/rock', {
    preHandler: [sessionAuthGuard, zodValidate({ params: safariTargetParamsSchema })],
    handler: controller.rockWild,
  });

  app.post('/safari/exit', {
    preHandler: [sessionAuthGuard],
    handler: controller.exit,
  });
}
