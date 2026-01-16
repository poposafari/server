import { AuditAction, AuditLog } from '@poposerver/shared';
import { AuditRepository } from './audit.repository';

export class AuditService {
  constructor(private readonly auditRepository: AuditRepository) {}

  async log(
    authId: string,
    action: AuditAction,
    ipAddress: string,
    detail: Record<string, any> = {},
  ): Promise<AuditLog> {
    return this.auditRepository.create(authId, action, ipAddress, detail);
  }

  async getLogsByAuthId(authId: string): Promise<AuditLog[]> {
    return this.auditRepository.findByAuthId(authId);
  }

  async getRecentLogs(limit: number = 100): Promise<AuditLog[]> {
    return this.auditRepository.findRecent(limit);
  }
}
