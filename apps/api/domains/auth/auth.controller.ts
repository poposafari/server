import { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '@poposerver/lib/utils/logger';
import { AppError } from '@poposerver/lib/utils/error';
import { AppErrorCode, AppErrorMessage } from '@poposerver/lib/types';
import { envConfig } from '@poposerver/lib/utils/env';
import {
  consumeOAuthState,
  createOAuthState,
  type OAuthProviderName,
} from '@poposerver/lib/redis';
import { AuthService } from './auth.service';
import { AuthLocalInput, LoginLocalInput } from './auth.schema';
import { isOAuthProviderName, oauthProviders } from './oauth/oauth.provider';
import { SESSION_COOKIE_NAME, sessionCookieOptions } from '@poposerver/lib/utils/cookie';

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  registerLocal = async (
    request: FastifyRequest<{ Body: AuthLocalInput }>,
    reply: FastifyReply,
  ) => {
    const sessionId = await this.authService.registerLocal(request.body);

    reply.setCookie(SESSION_COOKIE_NAME, sessionId, sessionCookieOptions);
    logger.info(`Register(local) success`);

    return reply.status(201).send({ success: true, data: null });
  };

  loginLocal = async (request: FastifyRequest<{ Body: LoginLocalInput }>, reply: FastifyReply) => {
    const sessionId = await this.authService.loginLocal(request.body);

    reply.setCookie(SESSION_COOKIE_NAME, sessionId, sessionCookieOptions);
    logger.info(`Login(local) success`);

    return reply.status(200).send({ success: true, data: null });
  };

  invalidateSession = async (request: FastifyRequest, reply: FastifyReply) => {
    await this.authService.invalidateSession(request.sessionId);

    reply.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions);

    return reply.status(200).send({ success: true, data: null });
  };

  logout = async (request: FastifyRequest, reply: FastifyReply) => {
    await this.authService.logout(request.sessionId);

    reply.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions);
    logger.info(`Logout success: authId=${request.authId}`);

    return reply.status(200).send({ success: true, data: null });
  };

  check = async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(200).send({ success: true, data: null });
  };

  oauthAuthorize = async (
    request: FastifyRequest<{ Params: { provider: string } }>,
    reply: FastifyReply,
  ) => {
    const { provider } = request.params;
    if (!isOAuthProviderName(provider)) {
      return reply.status(404).send({
        success: false,
        error: { code: 'UNKNOWN_PROVIDER', message: 'Unknown OAuth provider', status: 404 },
      });
    }
    const state = await createOAuthState(provider);
    const url = oauthProviders[provider].buildAuthorizeUrl(state);
    return reply.redirect(url, 302);
  };

  oauthCallback = async (
    request: FastifyRequest<{
      Params: { provider: string };
      Querystring: { code?: string; state?: string; error?: string };
    }>,
    reply: FastifyReply,
  ) => {
    const { provider } = request.params;
    const { code, state, error } = request.query;

    try {
      if (!isOAuthProviderName(provider)) {
        throw new AppError(
          AppErrorMessage.OAUTH_CANCELED,
          400,
          AppErrorCode.OAUTH_CANCELED,
        );
      }
      if (error || !code || !state) {
        throw new AppError(
          AppErrorMessage.OAUTH_CANCELED,
          400,
          AppErrorCode.OAUTH_CANCELED,
        );
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
      const sessionId = await this.authService.loginOrCreateOAuth(
        providerName,
        userInfo.providerId,
      );

      reply.setCookie(SESSION_COOKIE_NAME, sessionId, sessionCookieOptions);
      logger.info(`Login(${providerName}) success: providerId=${userInfo.providerId}`);
      return reply.redirect(envConfig.OAUTH_CLIENT_SUCCESS_URL, 302);
    } catch (e) {
      const errorCode = e instanceof AppError ? e.code : AppErrorCode.INTERNAL_SERVER_ERROR;
      logger.warn(`OAuth callback failed (${provider}): ${errorCode}`);
      const failureUrl = `${envConfig.OAUTH_CLIENT_FAILURE_URL}?code=${encodeURIComponent(errorCode)}`;
      return reply.redirect(failureUrl, 302);
    }
  };

  deleteAuth = async (request: FastifyRequest, reply: FastifyReply) => {
    await this.authService.softDeleteAuth(request.authId, request.sessionId);
    await this.authService.logout(request.sessionId);

    reply.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions);
    logger.info(`DeleteAuth success: authId=${request.authId}`);

    return reply.status(200).send({ success: true, data: null });
  };
}
