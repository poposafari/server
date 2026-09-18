import { RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { AppErrorCode } from '@poposerver/lib/types';
import { envConfig } from '@poposerver/lib/utils/env';

const passthrough: RequestHandler = (_req, _res, next) => next();

export function createLimiter(options: { windowMs: number; max: number }): RequestHandler {
  if (!envConfig.RATE_LIMIT_ENABLED) return passthrough;

  return rateLimit({
    windowMs: options.windowMs,
    limit: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      const resetTime = req.rateLimit?.resetTime;
      const ttl = resetTime ? resetTime.getTime() - Date.now() : options.windowMs;
      const retryAfter = Math.max(1, Math.ceil(ttl / 60000));

      res.status(429).json({
        statusCode: 429,
        code: AppErrorCode.EXCEED_REQUEST,
        error: 'Too Many Requests',
        message: `Too many requests. Please try again after ${retryAfter} minute(s).`,
        retryAfter,
      });
    },
  });
}
