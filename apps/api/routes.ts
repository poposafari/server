import { FastifyInstance } from 'fastify';

export async function registerRoutes(app: FastifyInstance) {
  await app.register(import('./domains/auth/auth.route'), { prefix: '/api/auth' });
  // await app.register(import('./domains/user/user.route'), { prefix: '/api/user' });
  // await app.register(import('./domains/game/game.route'), { prefix: '/api/game' });
}
