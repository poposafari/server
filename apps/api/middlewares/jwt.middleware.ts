import { Request, Response, NextFunction } from 'express';
import { AppError, AppErrorCode, verifyToken } from 'shared';

declare global {
  namespace Express {
    interface Request {
      authId: string;
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user?: {
    authId: string;
  };
}

export const jwtAuthGuard = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Access token missing', 401, AppErrorCode.UNAUTHORIZED);
    }

    const token = authHeader.split(' ')[1];

    const payload = verifyToken('access', token);
    if (!payload) {
      throw new AppError('Invalid access token', 401, AppErrorCode.AT_EXPIRED);
    }

    req.user = {
      authId: payload.authId,
    };

    next();
  } catch (error) {
    next(error);
  }
};
