import { FastifyInstance } from 'fastify';
import { sessionAuthGuard } from '../../hooks/session-auth.hook';
import { QueueController } from './queue.controller';
import { QueueService } from './queue.service';

export default async function queueRoutes(app: FastifyInstance) {
  const service = new QueueService();
  const controller = new QueueController(service);

  app.get('/status', {
    preHandler: [sessionAuthGuard],
    handler: controller.status,
  });

  app.post('/cancel', {
    preHandler: [sessionAuthGuard],
    handler: controller.cancel,
  });
}
