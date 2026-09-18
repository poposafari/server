import { AuditAction } from '@poposerver/lib/types';
import { RateLimitInfo } from 'express-rate-limit';

declare global {
  namespace Express {
    interface Request {
      authId: string;
      sessionId: string;
      audit?: {
        action: AuditAction;
        detail?: Record<string, unknown>;
        accountId?: number | null;
      };
      rateLimit?: RateLimitInfo;
    }
  }
}

export {};
