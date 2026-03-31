import { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '@poposerver/lib/utils/logger';
import { AuthService } from './auth.service';
import { AuthLocalInput } from './auth.schema';
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

  loginLocal = async (request: FastifyRequest<{ Body: AuthLocalInput }>, reply: FastifyReply) => {
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

  deleteAuth = async (request: FastifyRequest, reply: FastifyReply) => {
    await this.authService.softDeleteAuth(request.authId, request.sessionId);
    await this.authService.logout(request.sessionId);

    reply.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions);
    logger.info(`DeleteAuth success: authId=${request.authId}`);

    return reply.status(200).send({ success: true, data: null });
  };
}
