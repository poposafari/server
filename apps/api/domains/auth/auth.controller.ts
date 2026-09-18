import { Request, Response } from 'express';
import { logger } from '@poposerver/lib/utils/logger';
import { AppError } from '@poposerver/lib/utils/error';
import { AppErrorCode, AppErrorMessage, AuditAction } from '@poposerver/lib/types';
import { envConfig } from '@poposerver/lib/utils/env';
import { consumeOAuthState, createOAuthState, type OAuthProviderName } from '@poposerver/lib/state';
import { AuthService } from './auth.service';
import { AuthLocalInput, LoginLocalInput } from './auth.schema';
import { isOAuthProviderName, oauthProviders } from './oauth/oauth.provider';
import {
  SESSION_COOKIE_NAME,
  clearSessionCookieOptions,
  sessionCookieOptions,
} from '@poposerver/lib/utils/cookie';

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  registerLocal = async (req: Request<unknown, unknown, AuthLocalInput>, res: Response) => {
    const { sessionId, accountId } = await this.authService.registerLocal(req.body);

    res.cookie(SESSION_COOKIE_NAME, sessionId, sessionCookieOptions);
    req.audit = {
      action: AuditAction.REGISTER_LOCAL,
      accountId,
      detail: { username: req.body.username },
    };
    logger.info(`Register(local) success`);

    return res.status(201).json({ success: true, data: null });
  };

  loginLocal = async (req: Request<unknown, unknown, LoginLocalInput>, res: Response) => {
    const { sessionId, accountId } = await this.authService.loginLocal(req.body);

    res.cookie(SESSION_COOKIE_NAME, sessionId, sessionCookieOptions);
    req.audit = {
      action: AuditAction.LOGIN_LOCAL,
      accountId,
      detail: { username: req.body.username },
    };
    logger.info(`Login(local) success`);

    return res.status(201).json({ success: true, data: null });
  };

  invalidateSession = async (req: Request, res: Response) => {
    await this.authService.invalidateSession(req.sessionId);

    res.clearCookie(SESSION_COOKIE_NAME, clearSessionCookieOptions);

    return res.status(200).json({ success: true, data: null });
  };

  logout = async (req: Request, res: Response) => {
    await this.authService.logout(req.sessionId);

    res.clearCookie(SESSION_COOKIE_NAME, clearSessionCookieOptions);
    req.audit = { action: AuditAction.LOGOUT };
    logger.info(`Logout success: authId=${req.authId}`);

    return res.status(200).json({ success: true, data: null });
  };

  check = async (_req: Request, res: Response) => {
    res.header('Cache-Control', 'no-store');
    return res.status(200).json({ success: true, data: null });
  };

  oauthAuthorize = async (req: Request<{ provider: string }>, res: Response) => {
    const { provider } = req.params;
    if (!isOAuthProviderName(provider)) {
      return res.status(404).json({
        success: false,
        error: { code: 'UNKNOWN_PROVIDER', message: 'Unknown OAuth provider', status: 404 },
      });
    }
    const state = await createOAuthState(provider);
    const url = oauthProviders[provider].buildAuthorizeUrl(state);
    return res.redirect(302, url);
  };

  oauthCallback = async (
    req: Request<
      { provider: string },
      unknown,
      unknown,
      { code?: string; state?: string; error?: string }
    >,
    res: Response,
  ) => {
    const { provider } = req.params;
    const { code, state, error } = req.query;

    try {
      if (!isOAuthProviderName(provider)) {
        throw new AppError(AppErrorMessage.OAUTH_CANCELED, 400, AppErrorCode.OAUTH_CANCELED);
      }
      if (error || !code || !state) {
        throw new AppError(AppErrorMessage.OAUTH_CANCELED, 400, AppErrorCode.OAUTH_CANCELED);
      }

      const stored = await consumeOAuthState(state);
      if (!stored || stored.provider !== provider) {
        throw new AppError(
          AppErrorMessage.OAUTH_INVALID_STATE,
          400,
          AppErrorCode.OAUTH_INVALID_STATE,
        );
      }

      const providerName: OAuthProviderName = provider;
      const userInfo = await oauthProviders[providerName].exchangeCode(code);
      const { sessionId, accountId } = await this.authService.loginOrCreateOAuth(
        providerName,
        userInfo.providerId,
      );

      res.cookie(SESSION_COOKIE_NAME, sessionId, sessionCookieOptions);
      req.audit = {
        action: AuditAction.LOGIN_OAUTH,
        accountId,
        detail: { provider: providerName, providerId: userInfo.providerId },
      };
      logger.info(`Login(${providerName}) success: providerId=${userInfo.providerId}`);
      return res.redirect(302, envConfig.OAUTH_CLIENT_SUCCESS_URL);
    } catch (e) {
      const errorCode = e instanceof AppError ? e.code : AppErrorCode.INTERNAL_SERVER_ERROR;
      logger.warn(`OAuth callback failed (${provider}): ${errorCode}`);
      const failureUrl = `${envConfig.OAUTH_CLIENT_FAILURE_URL}?code=${encodeURIComponent(errorCode)}`;
      return res.redirect(302, failureUrl);
    }
  };

  deleteAuth = async (req: Request, res: Response) => {
    await this.authService.softDeleteAuth(req.authId, req.sessionId);

    res.clearCookie(SESSION_COOKIE_NAME, clearSessionCookieOptions);
    req.audit = { action: AuditAction.DELETE_AUTH };
    logger.info(`DeleteAuth success: authId=${req.authId}`);

    return res.status(204).send();
  };
}
