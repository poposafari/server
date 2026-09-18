import { Router } from 'express';
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

const router = Router();

const repo = new PokemonRepository();
const service = new PokemonService(repo);
const controller = new PokemonController(service);

router.get('/users/me/pokemons', sessionAuthGuard, controller.getBox);

router.get('/users/me/boxes', sessionAuthGuard, controller.getBoxMeta);

router.post(
  '/users/me/pokemons/:id/evolve',
  sessionAuthGuard,
  zodValidate({ params: pokemonParamsSchema, body: evolveSchema }),
  controller.evolve,
);

router.post(
  '/users/me/pokemons/:id/upgrade',
  sessionAuthGuard,
  zodValidate({ params: pokemonParamsSchema }),
  controller.upgrade,
);

router.post(
  '/users/me/pokemons/sell',
  sessionAuthGuard,
  zodValidate({ body: sellSchema }),
  controller.sell,
);

router.patch(
  '/users/me/pokemons',
  sessionAuthGuard,
  zodValidate({ body: arrangeSchema }),
  controller.arrange,
);

router.post(
  '/users/me/pokemons/:id/enhance',
  sessionAuthGuard,
  zodValidate({ params: pokemonParamsSchema, body: enhanceSchema }),
  controller.enhance,
);

router.post(
  '/users/me/pokemons/:id/moves',
  sessionAuthGuard,
  zodValidate({ params: pokemonParamsSchema, body: learnMoveSchema }),
  controller.learnMove,
);

export default router;
