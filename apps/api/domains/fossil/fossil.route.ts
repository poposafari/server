import { FastifyInstance } from 'fastify';
import { sessionAuthGuard } from '../../hooks/session-auth.hook';
import { zodValidate } from '../../hooks/validate.hook';
import { restoreFossilParamsSchema } from './fossil.schema';
import { FossilController } from './fossil.controller';
import { FossilService } from './fossil.service';

export default async function fossilRoutes(app: FastifyInstance) {
  const service = new FossilService();
  const controller = new FossilController(service);

  app.post('/users/me/fossils/:fossilId/restore', {
    preHandler: [sessionAuthGuard, zodValidate({ params: restoreFossilParamsSchema })],
    handler: controller.restore,
  });
}
