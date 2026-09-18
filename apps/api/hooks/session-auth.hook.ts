import { Request, Response, NextFunction } from 'express';
import { AppError } from '@poposerver/lib/utils/error';
import { AppErrorCode, AppErrorMessage } from '@poposerver/lib/types';
import { getSession } from '@poposerver/lib/state';
import { SESSION_COOKIE_NAME } from '@poposerver/lib/utils/cookie';

export async function sessionAuthGuard(req: Request, _res: Response, next: NextFunction) {
  const sessionId = req.cookies[SESSION_COOKIE_NAME];
  if (!sessionId) {
    throw new AppError(AppErrorMessage.SESSION_MISSING, 401, AppErrorCode.SESSION_MISSING);
  }

  const session = await getSession(sessionId);
  if (!session) {
    throw new AppError(AppErrorMessage.SESSION_EXPIRED, 401, AppErrorCode.SESSION_EXPIRED);
  }

  req.authId = session.authId;
  req.sessionId = sessionId;
  next();
}
