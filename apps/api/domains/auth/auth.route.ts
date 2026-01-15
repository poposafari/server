import { Router } from 'express';
import { AuthRepository } from './auth.repository';
import { AppDataSource, Auth, validate } from 'shared';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { authLocalSchema } from './auth.schema';
import { jwtAuthGuard } from 'apps/api/middlewares/jwt.middleware';

const router = Router();
const authRepository = new AuthRepository(AppDataSource.getRepository(Auth));
const authService = new AuthService(authRepository, AppDataSource);
const authController = new AuthController(authService);

router.post('/register/local', validate(authLocalSchema), authController.registerLocal);
router.post('/login/local', validate(authLocalSchema), authController.loginLocal);
router.post('/logout', jwtAuthGuard, authController.logout);
router.delete('/delete', jwtAuthGuard, authController.deleteAuth);
router.post('/refresh', authController.startRefreshTokenFlow);

export default router;
