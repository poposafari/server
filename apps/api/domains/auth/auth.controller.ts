import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { AuthLocalReq, AuthSuccessRes } from './auth.dto';
import {
  AppError,
  AppErrorCode,
  REFRESH_TOKEN_COOKIE_NAME,
  refreshTokenCookieOptions,
  AppErrorMessage,
  AuditAction,
} from '@poposerver/shared';
import { AuthenticatedRequest } from 'apps/api/middlewares/jwt.middleware';
import { logger } from '@poposerver/shared/utils/logger';
import { AuditService } from '../audit/audit.service';

export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly auditService: AuditService,
  ) {}

  registerLocal = async (
    req: Request<{}, AuthSuccessRes, AuthLocalReq>,
    res: Response<AuthSuccessRes>,
    next: NextFunction,
  ): Promise<void> => {
    try {
      logger.debug(`Register(local) attempt: ${JSON.stringify(req.body)}`);
      const request: AuthLocalReq = req.body;
      const result = await this.authService.registerLocal(request);

      res.cookie(REFRESH_TOKEN_COOKIE_NAME, result.refreshToken, refreshTokenCookieOptions);

      this.auditService.log(result.authId!, AuditAction.REGISTER_LOCAL, req.ip || '');
      logger.info(`Register(local) success: ${JSON.stringify(req.body)}`);

      res.status(201).json({ success: true, data: { accessToken: result.accessToken } });
    } catch (error) {
      logger.warn(`Register(local) error: ${JSON.stringify(error)}`);
      next(error);
    }
  };

  loginLocal = async (
    req: Request<{}, AuthSuccessRes, AuthLocalReq>,
    res: Response<AuthSuccessRes>,
    next: NextFunction,
  ): Promise<void> => {
    try {
      logger.debug(`Login(local) attempt: ${JSON.stringify(req.body)}`);
      const request: AuthLocalReq = req.body;
      const result = await this.authService.loginLocal(request);

      res.cookie(REFRESH_TOKEN_COOKIE_NAME, result.refreshToken, refreshTokenCookieOptions);

      this.auditService.log(result.authId!, AuditAction.LOGIN_LOCAL, req.ip || '');
      logger.info(`Login(local) success: ${JSON.stringify(req.body)}`);

      res.status(200).json({ success: true, data: { accessToken: result.accessToken } });
    } catch (error) {
      logger.warn(`Login(local) error: ${JSON.stringify(error)}`);
      next(error);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      logger.debug(`Logout attempt: ${JSON.stringify(req.body)}`);
      const authReq = req as AuthenticatedRequest;
      if (!authReq.user?.authId) {
        throw new AppError(AppErrorMessage.UNAUTHORIZED, 401, AppErrorCode.UNAUTHORIZED);
      }

      await this.authService.logout(authReq.user.authId);
      res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, refreshTokenCookieOptions);

      this.auditService.log(authReq.user.authId, AuditAction.LOGOUT, req.ip || '');
      logger.info(`Logout success: ${JSON.stringify(req.body)}`);

      res.status(200).json({ success: true, data: null });
    } catch (error) {
      logger.warn(`Logout error: ${JSON.stringify(error)}`);
      next(error);
    }
  };

  deleteAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      logger.debug(`DeleteAuth attempt: ${JSON.stringify(req.body)}`);
      const authReq = req as AuthenticatedRequest;
      if (!authReq.user?.authId) {
        throw new AppError(AppErrorMessage.UNAUTHORIZED, 401, AppErrorCode.UNAUTHORIZED);
      }

      await this.authService.softDeleteAuth(authReq.user.authId);
      res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, refreshTokenCookieOptions);

      this.auditService.log(authReq.user.authId, AuditAction.DELETE_AUTH, req.ip || '');
      logger.info(`DeleteAuth success: ${JSON.stringify(req.body)}`);
      res.status(200).json({ success: true, data: null });
    } catch (error) {
      logger.warn(`DeleteAuth error: ${JSON.stringify(error)}`);
      next(error);
    }
  };

  startRefreshTokenFlow = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      logger.debug(`StartRefreshTokenFlow attempt: ${JSON.stringify(req.body)}`);
      const refreshToken = req.cookies[REFRESH_TOKEN_COOKIE_NAME];
      if (!refreshToken) {
        throw new AppError(AppErrorMessage.REFRESH_TOKEN_MISSING, 401, AppErrorCode.UNAUTHORIZED);
      }

      const { accessToken } = await this.authService.startRefreshTokenFlow(refreshToken);

      logger.info(`StartRefreshTokenFlow success: ${JSON.stringify(req.body)}`);
      res.status(200).json({ success: true, data: { accessToken } });
    } catch (error) {
      logger.warn(`StartRefreshTokenFlow error: ${JSON.stringify(error)}`);
      next(error);
    }
  };
}
