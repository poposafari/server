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
  sellSchema,
} from './pokemon.schema';

export default async function pokemonRoutes(app: FastifyInstance) {
  const repo = new PokemonRepository();
  const service = new PokemonService(repo);
  const controller = new PokemonController(service);

  app.get('/box', {
    preHandler: [sessionAuthGuard],
    handler: controller.getBox,
  });

  app.get('/box/meta', {
    preHandler: [sessionAuthGuard],
    handler: controller.getBoxMeta,
  });

  app.post('/evolve', {
    preHandler: [sessionAuthGuard, zodValidate(evolveSchema)],
    handler: controller.evolve,
  });

  app.post('/sell', {
    preHandler: [sessionAuthGuard, zodValidate(sellSchema)],
    handler: controller.sell,
  });

  app.patch('/box/arrange', {
    preHandler: [sessionAuthGuard, zodValidate(arrangeSchema)],
    handler: controller.arrange,
  });

  app.post('/enhance', {
    preHandler: [sessionAuthGuard, zodValidate(enhanceSchema)],
    handler: controller.enhance,
  });

  app.post('/learn-move', {
    preHandler: [sessionAuthGuard, zodValidate(learnMoveSchema)],
    handler: controller.learnMove,
  });
}
