import { AuditLog, AuditAction } from '@poposerver/shared';
import { Repository } from 'typeorm';

export class AuditRepository {
  constructor(private readonly auditRepository: Repository<AuditLog>) {}

  async create(
    authId: string,
    action: AuditAction,
    ipAddress: string,
    detail: Record<string, any> = {},
  ): Promise<AuditLog> {
    const log = this.auditRepository.create({
      authId,
      action,
      ipAddress,
      detail,
    });
    return this.auditRepository.save(log);
  }

  async findByAuthId(authId: string): Promise<AuditLog[]> {
    return this.auditRepository.find({
      where: { authId },
      order: { createAt: 'DESC' },
    });
  }

  async findRecent(limit: number = 100): Promise<AuditLog[]> {
    return this.auditRepository.find({
      order: { createAt: 'DESC' },
      take: limit,
    });
  }
}
