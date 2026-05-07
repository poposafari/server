import { FastifyInstance } from 'fastify';

export async function registerRoutes(app: FastifyInstance) {
  await app.register(import('./domains/auth/auth.route'), { prefix: '/api/auth' });
  await app.register(import('./domains/user/user.route'), { prefix: '/api/user' });
  await app.register(import('./domains/pokemon/pokemon.route'), { prefix: '/api/pokemon' });
  await app.register(import('./domains/item/item.route'), { prefix: '/api/item' });
  await app.register(import('./domains/pokedex/pokedex.route'), { prefix: '/api/pokedex' });
  await app.register(import('./domains/town-map/town-map.route'), { prefix: '/api/town-map' });
  await app.register(import('./domains/costume/costume.route'), { prefix: '/api/costume' });
  await app.register(import('./domains/game/game.route'), { prefix: '/api/game' });
  await app.register(import('./domains/internal/internal.route'), { prefix: '/api/__internal' });
}
