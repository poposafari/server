import { Router } from 'express';
import { AuthRepository } from './auth.repository';
import { AppDataSource, AuditLog, Auth, validate } from '@poposerver/shared';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { authLocalSchema } from './auth.schema';
import { jwtAuthGuard } from 'apps/api/middlewares/jwt.middleware';
import { AuditRepository } from '../audit/audit.repository';
import { AuditService } from '../audit/audit.service';
import { authLimiter } from 'apps/api/middlewares';

const router = Router();

const authRepository = new AuthRepository(AppDataSource.getRepository(Auth));
const auditRepository = new AuditRepository(AppDataSource.getRepository(AuditLog));

const auditService = new AuditService(auditRepository);
const authService = new AuthService(authRepository, AppDataSource);

const authController = new AuthController(authService, auditService);

router.post('/register/local', validate(authLocalSchema), authController.registerLocal);
router.post('/login/local', authLimiter, validate(authLocalSchema), authController.loginLocal);
router.post('/logout', jwtAuthGuard, authController.logout);
router.delete('/delete', jwtAuthGuard, authController.deleteAuth);
router.post('/refresh', authController.startRefreshTokenFlow);

export default router;
