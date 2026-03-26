import { FastifyRequest, FastifyReply } from 'fastify';
import { AppError } from '@poposerver/lib/utils/error';
import { AppErrorCode, AppErrorMessage } from '@poposerver/lib/types';
import { getSession } from '@poposerver/lib/redis';
import { SESSION_COOKIE_NAME } from '@poposerver/lib/utils/cookie';

declare module 'fastify' {
  interface FastifyRequest {
    authId: string;
    sessionId: string;
  }
}

export async function sessionAuthGuard(request: FastifyRequest, _reply: FastifyReply) {
  const sessionId = request.cookies[SESSION_COOKIE_NAME];
  if (!sessionId) {
    throw new AppError(AppErrorMessage.SESSION_MISSING, 401, AppErrorCode.SESSION_MISSING);
  }

  const session = await getSession(sessionId);
  if (!session) {
    throw new AppError(AppErrorMessage.SESSION_EXPIRED, 401, AppErrorCode.SESSION_EXPIRED);
  }

  request.authId = session.authId;
  request.sessionId = sessionId;
}
