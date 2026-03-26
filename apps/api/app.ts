import Fastify, { FastifyError, FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { envConfig } from '@poposerver/lib/utils/env';
import { logger } from '@poposerver/lib/utils/logger';
import { AppError } from '@poposerver/lib/utils/error';
import { AppErrorCode, AppErrorRes } from '@poposerver/lib/types';
import { registerRoutes } from './routes';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
    trustProxy: true,
  });

  // ── 보안 헤더 ──
  await app.register(helmet);

  // ── CORS ──
  await app.register(cors, {
    origin: envConfig.CORS_ORIGIN || '*',
    credentials: true,
  });

  // ── 쿠키 파싱 ──
  await app.register(cookie);

  // ── 레이트 리밋 (조건부) ──
  if (envConfig.RATE_LIMIT_ENABLED) {
    await app.register(rateLimit, {
      max: 60,
      timeWindow: '1 minute',
      errorResponseBuilder: () => ({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again after 1 minute.',
          status: 429,
        },
      }),
    });
  }

  // ── 요청 로깅 hook ──
  app.addHook('onRequest', (request, _reply, done) => {
    logger.debug(`→ ${request.method} ${request.url}`);
    done();
  });

  app.addHook('onResponse', (request, reply, done) => {
    logger.info(`← ${request.method} ${request.url} ${reply.statusCode}`);
    done();
  });

  // ── Health check ──
  app.get('/health', async () => {
    return { message: 'Poposafari server is running' };
  });

  // ── 라우트 등록 ──
  await registerRoutes(app);

  // ── Not Found 핸들러 ──
  app.setNotFoundHandler((request, reply) => {
    const response: AppErrorRes = {
      success: false,
      error: {
        code: AppErrorCode.NOT_FOUND,
        message:
          envConfig.NODE_ENV === 'DEV' ? `Route ${request.method} ${request.url} not found` : null,
        status: 404,
      },
    };
    reply.status(404).send(response);
  });

  // ── 전역 에러 핸들러 ──
  app.setErrorHandler((error: FastifyError | AppError | Error, _request, reply) => {
    let statusCode = 500;
    let errorCode = AppErrorCode.INTERNAL_SERVER_ERROR;
    let message: string | null = 'Internal Server Error';

    if (error instanceof AppError) {
      statusCode = error.statusCode;
      errorCode = error.code;
      message = envConfig.NODE_ENV === 'DEV' ? error.message : null;
    } else if ('validation' in error && (error as FastifyError).validation) {
      statusCode = 400;
      errorCode = AppErrorCode.DTO_INVALID;
      message = error.message;
    } else {
      message = envConfig.NODE_ENV === 'DEV' ? error.message : null;
      logger.error('[UNHANDLED ERROR]', error);
    }

    const response: AppErrorRes = {
      success: false,
      error: {
        code: errorCode,
        message,
        status: statusCode,
      },
    };

    reply.status(statusCode).send(response);
  });

  return app;
}
