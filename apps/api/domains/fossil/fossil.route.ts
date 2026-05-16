import { FastifyInstance } from 'fastify';
import { sessionAuthGuard } from '../../hooks/session-auth.hook';
import { zodValidate } from '../../hooks/validate.hook';
import { restoreFossilSchema } from './fossil.schema';
import { FossilController } from './fossil.controller';
import { FossilService } from './fossil.service';

export default async function fossilRoutes(app: FastifyInstance) {
  const service = new FossilService();
  const controller = new FossilController(service);

  app.post('/restore', {
    preHandler: [sessionAuthGuard, zodValidate(restoreFossilSchema)],
    handler: controller.restore,
  });
}
