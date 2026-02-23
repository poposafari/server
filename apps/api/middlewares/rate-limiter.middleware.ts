import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { envConfig } from '@poposerver/shared/utils';

export const globalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 min
  max: 60, // Maximum 60 requests per minute
  message: {
    success: false,
    message: 'Too many requests. Please try again after 1 minute.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 5, // Maximum 5 attempts allowed
  message: {
    success: false,
    message: 'Too many login attempts. Please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/** RATE_LIMIT_ENABLED가 false면 통과, true면 authLimiter 적용 (부하 테스트 시 로그인 리밋 완화용) */
export const authLimiterIfEnabled = (req: Request, res: Response, next: NextFunction): void => {
  if (envConfig.RATE_LIMIT_ENABLED) {
    authLimiter(req, res, next);
  } else {
    next();
  }
};
