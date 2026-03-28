import { FastifyInstance } from 'fastify';
import { sessionAuthGuard } from '../../hooks/session-auth.hook';
import { CostumeController } from './costume.controller';
import { CostumeService } from './costume.service';
import { CostumeRepository } from './costume.repository';

export default async function costumeRoutes(app: FastifyInstance) {
  const repo = new CostumeRepository();
  const service = new CostumeService(repo);
  const controller = new CostumeController(service);

  app.get('/', {
    preHandler: [sessionAuthGuard],
    handler: controller.getAll,
  });
}
