import { FastifyInstance } from 'fastify';
import { sessionAuthGuard } from '../../hooks/session-auth.hook';
import { PokemonController } from './pokemon.controller';
import { PokemonService } from './pokemon.service';
import { PokemonRepository } from './pokemon.repository';

export default async function pokemonRoutes(app: FastifyInstance) {
  const repo = new PokemonRepository();
  const service = new PokemonService(repo);
  const controller = new PokemonController(service);

  app.get('/box', {
    preHandler: [sessionAuthGuard],
    handler: controller.getBox,
  });
}
