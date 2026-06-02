import { db } from '../db';
import { auditLog } from '../schema/audit-log';
import { logger } from './logger';
import type { AuditEntry } from '../types/audit.type';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const REDACT_KEYS = new Set([
  'password',
  'newPassword',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
]);
const MAX_BODY_BYTES = 2048;

export function redactBody(body: unknown): Record<string, unknown> | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const out = Object.fromEntries(
    Object.entries(body as Record<string, unknown>).map(([k, v]) => [
      k,
      REDACT_KEYS.has(k) ? '[REDACTED]' : v,
    ]),
  );
  const json = JSON.stringify(out);
  if (json.length > MAX_BODY_BYTES) return { _truncated: json.slice(0, MAX_BODY_BYTES) };
  return out;
}

const toRow = (e: AuditEntry) => ({
  accountId: e.accountId,
  action: e.action,
  status: e.status ?? null,
  detail: e.detail ?? null,
  ip: e.ip ?? null,
  userAgent: e.userAgent ?? null,
  source: e.source,
});

export async function auditTx(tx: Tx, entry: AuditEntry): Promise<void> {
  await tx.insert(auditLog).values(toRow(entry));
}

export async function auditAsync(entry: AuditEntry): Promise<void> {
  try {
    await db.insert(auditLog).values(toRow(entry));
  } catch (err) {
    logger.error(`[Audit] write failed action=${entry.action}`, err);
  }
}
