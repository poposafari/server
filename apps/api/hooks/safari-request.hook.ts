import { NextFunction, Request, RequestHandler, Response } from 'express';
import { AppErrorCode } from '@poposerver/lib/types';
import { AppError } from '@poposerver/lib/utils/error';

const inFlight = new Set<string>();

export function markReceivedAt(req: Request, _res: Response, next: NextFunction) {
  req.receivedAt = Date.now();
  next();
}

export function oneSafariRequestPerUser(handler: RequestHandler): RequestHandler {
  return async (req, res, next) => {
    const { authId } = req;
    if (inFlight.has(authId)) {
      throw new AppError(
        'Another safari request is in progress',
        409,
        AppErrorCode.SAFARI_REQUEST_IN_PROGRESS,
      );
    }
    inFlight.add(authId);
    try {
      await handler(req, res, next);
    } finally {
      inFlight.delete(authId);
    }
  };
}
