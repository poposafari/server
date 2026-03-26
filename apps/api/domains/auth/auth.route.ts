import { FastifyInstance } from 'fastify';
import { sessionAuthGuard } from '../../hooks/session-auth.hook';
import { zodValidate } from '../../hooks/validate.hook';
import { authLocalSchema } from './auth.schema';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';

export default async function authRoutes(app: FastifyInstance) {
  const authRepository = new AuthRepository();
  const authService = new AuthService(authRepository);
  const authController = new AuthController(authService);

  // 인증 불필요
  app.post('/register/local', {
    preHandler: [zodValidate(authLocalSchema)],
    handler: authController.registerLocal,
  });

  app.post('/login/local', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '15 minutes',
      },
    },
    preHandler: [zodValidate(authLocalSchema)],
    handler: authController.loginLocal,
  });

  // 인증 필요
  app.post('/logout', {
    preHandler: [sessionAuthGuard],
    handler: authController.logout,
  });

  app.post('/check', {
    preHandler: [sessionAuthGuard],
    handler: authController.check,
  });

  app.delete('/delete', {
    preHandler: [sessionAuthGuard],
    handler: authController.deleteAuth,
  });
}
