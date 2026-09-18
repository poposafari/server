import { FastifyInstance } from 'fastify';
import { sessionAuthGuard } from '../../hooks/session-auth.hook';
import { PokedexController } from './pokedex.controller';
import { PokedexService } from './pokedex.service';
import { PokedexRepository } from './pokedex.repository';

export default async function pokedexRoutes(app: FastifyInstance) {
  const repo = new PokedexRepository();
  const service = new PokedexService(repo);
  const controller = new PokedexController(service);

  app.get('/users/me/pokedex', {
    preHandler: [sessionAuthGuard],
    handler: controller.getAll,
  });
}
