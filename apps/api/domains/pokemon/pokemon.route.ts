import { FastifyInstance } from 'fastify';
import { sessionAuthGuard } from '../../hooks/session-auth.hook';
import { zodValidate } from '../../hooks/validate.hook';
import { PokemonController } from './pokemon.controller';
import { PokemonService } from './pokemon.service';
import { PokemonRepository } from './pokemon.repository';
import {
  arrangeSchema,
  enhanceSchema,
  evolveSchema,
  learnMoveSchema,
  pokemonParamsSchema,
  sellSchema,
} from './pokemon.schema';

export default async function pokemonRoutes(app: FastifyInstance) {
  const repo = new PokemonRepository();
  const service = new PokemonService(repo);
  const controller = new PokemonController(service);

  app.get('/users/me/pokemons', {
    preHandler: [sessionAuthGuard],
    handler: controller.getBox,
  });

  app.get('/users/me/boxes', {
    preHandler: [sessionAuthGuard],
    handler: controller.getBoxMeta,
  });

  app.post('/users/me/pokemons/:id/evolve', {
    preHandler: [
      sessionAuthGuard,
      zodValidate({ params: pokemonParamsSchema, body: evolveSchema }),
    ],
    handler: controller.evolve,
  });

  app.post('/users/me/pokemons/:id/upgrade', {
    preHandler: [sessionAuthGuard, zodValidate({ params: pokemonParamsSchema })],
    handler: controller.upgrade,
  });

  app.post('/users/me/pokemons/sell', {
    preHandler: [sessionAuthGuard, zodValidate({ body: sellSchema })],
    handler: controller.sell,
  });

  app.patch('/users/me/pokemons', {
    preHandler: [sessionAuthGuard, zodValidate({ body: arrangeSchema })],
    handler: controller.arrange,
  });

  app.post('/users/me/pokemons/:id/enhance', {
    preHandler: [
      sessionAuthGuard,
      zodValidate({ params: pokemonParamsSchema, body: enhanceSchema }),
    ],
    handler: controller.enhance,
  });

  app.post('/users/me/pokemons/:id/moves', {
    preHandler: [
      sessionAuthGuard,
      zodValidate({ params: pokemonParamsSchema, body: learnMoveSchema }),
    ],
    handler: controller.learnMove,
  });
}
