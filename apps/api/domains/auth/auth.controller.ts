import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { AuthLocalReq, AuthSuccessRes } from './auth.dto';
import {
  AppError,
  AppErrorCode,
  REFRESH_TOKEN_COOKIE_NAME,
  refreshTokenCookieOptions,
  AppErrorMessage,
} from '@poposerver/shared';
import { AuthenticatedRequest } from 'apps/api/middlewares/jwt.middleware';

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  registerLocal = async (
    req: Request<{}, AuthSuccessRes, AuthLocalReq>,
    res: Response<AuthSuccessRes>,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const request: AuthLocalReq = req.body;
      const result = await this.authService.registerLocal(request);

      res.cookie(REFRESH_TOKEN_COOKIE_NAME, result.refreshToken, refreshTokenCookieOptions);

      res.status(201).json({ success: true, data: { accessToken: result.accessToken } });
    } catch (error) {
      next(error);
    }
  };

  loginLocal = async (
    req: Request<{}, AuthSuccessRes, AuthLocalReq>,
    res: Response<AuthSuccessRes>,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const request: AuthLocalReq = req.body;
      const result = await this.authService.loginLocal(request);

      res.cookie(REFRESH_TOKEN_COOKIE_NAME, result.refreshToken, refreshTokenCookieOptions);

      res.status(200).json({ success: true, data: { accessToken: result.accessToken } });
    } catch (error) {
      next(error);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      if (!authReq.user?.authId) {
        throw new AppError(AppErrorMessage.UNAUTHORIZED, 401, AppErrorCode.UNAUTHORIZED);
      }

      await this.authService.logout(authReq.user.authId);
      res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, refreshTokenCookieOptions);

      res.status(200).json({ success: true, data: null });
    } catch (error) {
      next(error);
    }
  };

  deleteAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      if (!authReq.user?.authId) {
        throw new AppError(AppErrorMessage.UNAUTHORIZED, 401, AppErrorCode.UNAUTHORIZED);
      }

      await this.authService.softDeleteAuth(authReq.user.authId);
      res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, refreshTokenCookieOptions);

      res.status(200).json({ success: true, data: null });
    } catch (error) {
      next(error);
    }
  };

  startRefreshTokenFlow = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const refreshToken = req.cookies[REFRESH_TOKEN_COOKIE_NAME];
      if (!refreshToken) {
        throw new AppError(AppErrorMessage.REFRESH_TOKEN_MISSING, 401, AppErrorCode.UNAUTHORIZED);
      }

      const { accessToken } = await this.authService.startRefreshTokenFlow(refreshToken);

      res.status(200).json({ success: true, data: { accessToken } });
    } catch (error) {
      next(error);
    }
  };
}
