import { Router } from 'express';
import { sessionAuthGuard } from '../../hooks/session-auth.hook';
import { zodValidate } from '../../hooks/validate.hook';
import { createLimiter } from '../../hooks/rate-limit.hook';
import { authLocalSchema, loginLocalSchema } from './auth.schema';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';

const router = Router();

const authRepository = new AuthRepository();
const authService = new AuthService(authRepository);
const authController = new AuthController(authService);

const loginLimiter = createLimiter({ windowMs: 5 * 60 * 1000, max: 10 });
const oauthLimiter = createLimiter({ windowMs: 15 * 60 * 1000, max: 20 });

// 인증 불필요
router.post('/accounts', zodValidate({ body: authLocalSchema }), authController.registerLocal);

router.post(
  '/sessions',
  loginLimiter,
  zodValidate({ body: loginLocalSchema }),
  authController.loginLocal,
);

router.get('/auth/oauth/:provider/authorize', oauthLimiter, authController.oauthAuthorize);

router.get('/auth/oauth/:provider/callback', oauthLimiter, authController.oauthCallback);

// 인증 필요
router.post('/auth/invalidate-session', sessionAuthGuard, authController.invalidateSession);

router.post('/auth/logout', sessionAuthGuard, authController.logout);

router.get('/sessions/current', sessionAuthGuard, authController.check);

router.delete('/accounts/me', sessionAuthGuard, authController.deleteAuth);

export default router;
