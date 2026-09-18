import { FastifyInstance } from 'fastify';
import { sessionAuthGuard } from '../../hooks/session-auth.hook';
import { zodValidate } from '../../hooks/validate.hook';
import { authLocalSchema, loginLocalSchema } from './auth.schema';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';

export default async function authRoutes(app: FastifyInstance) {
  const authRepository = new AuthRepository();
  const authService = new AuthService(authRepository);
  const authController = new AuthController(authService);

  // 인증 불필요
  app.post('/accounts', {
    preHandler: [zodValidate({ body: authLocalSchema })],
    handler: authController.registerLocal,
  });

  app.post('/sessions', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '5 minutes',
      },
    },
    preHandler: [zodValidate({ body: loginLocalSchema })],
    handler: authController.loginLocal,
  });

  app.get('/auth/oauth/:provider/authorize', {
    config: {
      rateLimit: {
        max: 20,
        timeWindow: '15 minutes',
      },
    },
    handler: authController.oauthAuthorize,
  });

  app.get('/auth/oauth/:provider/callback', {
    config: {
      rateLimit: {
        max: 20,
        timeWindow: '15 minutes',
      },
    },
    handler: authController.oauthCallback,
  });

  // 인증 필요
  app.post('/auth/invalidate-session', {
    preHandler: [sessionAuthGuard],
    handler: authController.invalidateSession,
  });

  app.post('/auth/logout', {
    preHandler: [sessionAuthGuard],
    handler: authController.logout,
  });

  app.get('/sessions/current', {
    preHandler: [sessionAuthGuard],
    handler: authController.check,
  });

  app.delete('/accounts/me', {
    preHandler: [sessionAuthGuard],
    handler: authController.deleteAuth,
  });
}
