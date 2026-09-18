import express, { Express, NextFunction, Request, Response } from 'express';
import { STATUS_CODES } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { envConfig } from '@poposerver/lib/utils/env';
import { logger } from '@poposerver/lib/utils/logger';
import { AppError } from '@poposerver/lib/utils/error';
import { AppErrorCode, AppErrorRes, AuditAction } from '@poposerver/lib/types';
import { auditAsync, redactBody } from '@poposerver/lib/utils/audit';
import { loadtestMetrics } from '@poposerver/lib/utils/loadtest-metrics';
import { createLimiter } from './hooks/rate-limit.hook';
import { registerRoutes } from './routes';

const AUDIT_ERROR_CODES = new Set<AppErrorCode>([
  AppErrorCode.FAILED_ACCOUNT,
  AppErrorCode.DTO_INVALID,
  AppErrorCode.SESSION_MISSING,
  AppErrorCode.SESSION_EXPIRED,
  AppErrorCode.OAUTH_INVALID_STATE,
  AppErrorCode.ITEM_NOT_OWNED,
]);
const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const BODY_LIMIT = '1mb';

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

function requestLogger(req: Request, res: Response, next: NextFunction) {
  logger.debug(`→ ${req.method} ${req.originalUrl}`);
  res.on('finish', () => {
    logger.info(`← ${req.method} ${req.originalUrl} ${res.statusCode}`);
  });
  next();
}

function auditOnFinish(req: Request, res: Response, next: NextFunction) {
  res.on('finish', () => {
    const a = req.audit;
    if (!a) return;
    if (res.statusCode >= 400) return;
    const fallbackId = req.authId ? Number(req.authId) : null;
    auditAsync({
      accountId: a.accountId !== undefined ? a.accountId : fallbackId,
      action: a.action,
      status: res.statusCode,
      detail: a.detail,
      ip: req.ip,
      userAgent: req.headers['user-agent'] ?? null,
      source: 'api',
    }).catch((e) => logger.error('[Audit] onFinish record failed', e));
  });
  next();
}

function recordSecurityAudit(req: Request, error: unknown, statusCode: number) {
  if (!MUTATION_METHODS.has(req.method)) return;
  if (!(error instanceof AppError)) return;
  if (!AUDIT_ERROR_CODES.has(error.code)) return;

  auditAsync({
    accountId: req.authId ? Number(req.authId) : null,
    action:
      error.code === AppErrorCode.FAILED_ACCOUNT
        ? AuditAction.LOGIN_FAILED
        : AuditAction.REQUEST_REJECTED,
    status: statusCode,
    detail: {
      method: req.method,
      url: req.originalUrl,
      errorCode: error.code,
      body: redactBody(req.body),
    },
    ip: req.ip,
    userAgent: req.headers['user-agent'] ?? null,
    source: 'api',
  }).catch((auditErr) => logger.error('[Audit] error security record failed', auditErr));
}

function notFoundHandler(req: Request, res: Response) {
  const response: AppErrorRes = {
    success: false,
    error: {
      code: AppErrorCode.NOT_FOUND,
      message:
        envConfig.NODE_ENV === 'DEV' ? `Route ${req.method} ${req.originalUrl} not found` : null,
      status: 404,
    },
  };
  res.status(404).json(response);
}

function errorHandler(error: Error, req: Request, res: Response, _next: NextFunction) {
  const isAppError = error instanceof AppError;
  const statusCode = isAppError ? error.statusCode : 500;

  if (!isAppError) {
    const detail = unwrapErrorChain(error);
    logger.error(`[UNHANDLED ERROR] ${detail}${error.stack ? `\n${error.stack}` : ''}`);
  }

  recordSecurityAudit(req, error, statusCode);

  if (res.headersSent) return;

  res.status(statusCode).json({
    statusCode,
    ...(isAppError && { code: error.code }),
    error: STATUS_CODES[statusCode] ?? 'Internal Server Error',
    message: error.message,
  });
}

export function buildApp(): Express {
  const app = express();

  app.set('etag', false);
  app.set('trust proxy', true);

  app.use(
    cors({
      origin: envConfig.CORS_ORIGIN || '*',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      maxAge: 86400,
    }),
  );

  // ── 보안 헤더 ──
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  // ── 쿠키 파싱 ──
  app.use(cookieParser());

  // ── 본문 파싱 ──
  app.use(express.json({ limit: BODY_LIMIT }));

  // ── 레이트 리밋 (조건부) ──
  app.use(createLimiter({ windowMs: 60 * 1000, max: envConfig.RATE_LIMIT_GLOBAL_MAX }));

  // ── 요청 로깅 ──
  app.use(requestLogger);

  // ── 감사 로그 ──
  app.use(auditOnFinish);

  // ── Health check ──
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ message: 'Poposafari server is running' });
  });

  // ── 부하 테스트 계측 (LOADTEST_METRICS=true 일 때만 노출) ──
  if (envConfig.LOADTEST_METRICS) {
    app.get('/loadtest/metrics', (_req: Request, res: Response) => {
      res.json(loadtestMetrics.snapshot());
    });
  }

  // ── 라우트 등록 ──
  registerRoutes(app);

  // ── Not Found 핸들러 ──
  app.use(notFoundHandler);

  // ── 전역 에러 핸들러 ──
  app.use(errorHandler);

  return app;
}
