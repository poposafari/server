import { FastifyInstance } from 'fastify';

export async function registerRoutes(app: FastifyInstance) {
  await app.register(import('./domains/auth/auth.route'), { prefix: '/api' });
  await app.register(import('./domains/user/user.route'), { prefix: '/api' });
  await app.register(import('./domains/pokemon/pokemon.route'), { prefix: '/api' });
  await app.register(import('./domains/item/item.route'), { prefix: '/api' });
  await app.register(import('./domains/pokedex/pokedex.route'), { prefix: '/api' });
  await app.register(import('./domains/town-map/town-map.route'), { prefix: '/api' });
  await app.register(import('./domains/costume/costume.route'), { prefix: '/api' });
  await app.register(import('./domains/game/game.route'), { prefix: '/api' });
  await app.register(import('./domains/safari/safari.route'), { prefix: '/api' });
  await app.register(import('./domains/fossil/fossil.route'), { prefix: '/api' });
  await app.register(import('./domains/internal/internal.route'), { prefix: '/api/__internal' });
}
