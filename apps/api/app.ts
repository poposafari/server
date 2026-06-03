import Fastify, { FastifyError, FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { envConfig } from '@poposerver/lib/utils/env';
import { logger } from '@poposerver/lib/utils/logger';
import { AppError } from '@poposerver/lib/utils/error';
import { AppErrorCode, AppErrorRes, AuditAction } from '@poposerver/lib/types';
import { auditAsync, redactBody } from '@poposerver/lib/utils/audit';
import { registerRoutes } from './routes';

declare module 'fastify' {
  interface FastifyRequest {
    audit?: { action: AuditAction; detail?: Record<string, unknown>; accountId?: number | null };
  }
}

const AUDIT_ERROR_CODES = new Set<AppErrorCode>([
  AppErrorCode.FAILED_ACCOUNT,
  AppErrorCode.DTO_INVALID,
  AppErrorCode.SESSION_MISSING,
  AppErrorCode.SESSION_EXPIRED,
  AppErrorCode.OAUTH_INVALID_STATE,
  AppErrorCode.POKEMON_NOT_OWNED,
  AppErrorCode.ITEM_NOT_OWNED,
]);
const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const PG_DIAGNOSTIC_FIELDS = [
  'code',
  'detail',
  'constraint',
  'constraint_name',
  'table',
  'table_name',
  'column',
  'column_name',
] as const;

function unwrapErrorChain(err: unknown, maxDepth = 5): string {
  const parts: string[] = [];
  let cur: unknown = err;
  let depth = 0;
  while (cur != null && depth < maxDepth) {
    const e = cur as Record<string, unknown>;
    const msg = typeof e.message === 'string' && e.message ? e.message : String(cur);
    const diag = PG_DIAGNOSTIC_FIELDS.filter((k) => e[k] != null).map(
      (k) => `${k}=${String(e[k])}`,
    );
    parts.push(diag.length ? `${msg} (${diag.join(', ')})` : msg);
    cur = e.cause;
    depth += 1;
  }
  return parts.join(' ← caused by: ');
}

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
    trustProxy: true,
  });

  await app.register(cors, {
    origin: envConfig.CORS_ORIGIN || '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  });

  // ── 보안 헤더 ──
  await app.register(helmet, {
    crossOriginResourcePolicy: { policy: 'cross-origin' },
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

  app.addHook('onResponse', async (request, reply) => {
    const a = request.audit;
    if (!a) return;
    if (reply.statusCode >= 400) return;
    const fallbackId = request.authId ? Number(request.authId) : null;
    await auditAsync({
      accountId: a.accountId !== undefined ? a.accountId : fallbackId,
      action: a.action,
      status: reply.statusCode,
      detail: a.detail,
      ip: request.ip,
      userAgent: request.headers['user-agent'] ?? null,
      source: 'api',
    });
  });

  app.addHook('onError', async (request, _reply, error) => {
    try {
      if (!MUTATION_METHODS.has(request.method)) return;

      let statusCode: number;
      let errorCode: AppErrorCode;
      if (error instanceof AppError) {
        statusCode = error.statusCode;
        errorCode = error.code;
      } else if ('validation' in error && (error as FastifyError).validation) {
        statusCode = 400;
        errorCode = AppErrorCode.DTO_INVALID;
      } else {
        return;
      }

      if (!AUDIT_ERROR_CODES.has(errorCode)) return;

      await auditAsync({
        accountId: request.authId ? Number(request.authId) : null,
        action:
          errorCode === AppErrorCode.FAILED_ACCOUNT
            ? AuditAction.LOGIN_FAILED
            : AuditAction.REQUEST_REJECTED,
        status: statusCode,
        detail: {
          method: request.method,
          url: request.url,
          errorCode,
          body: redactBody(request.body),
        },
        ip: request.ip,
        userAgent: request.headers['user-agent'] ?? null,
        source: 'api',
      });
    } catch (auditErr) {
      logger.error('[Audit] onError security record failed', auditErr);
    }
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
      message = envConfig.NODE_ENV === 'DEV' ? error.message : null;
    } else {
      const detail = unwrapErrorChain(error);
      message = envConfig.NODE_ENV === 'DEV' ? detail : null;
      const stack = error instanceof Error ? error.stack : undefined;
      logger.error(`[UNHANDLED ERROR] ${detail}${stack ? `\n${stack}` : ''}`);
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
