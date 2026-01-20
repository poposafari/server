import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Auth } from './auth.entity';
import { AuditAction } from '../types';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'auth_id', type: 'bigint', nullable: true })
  authId!: string | null;

  @Column({ type: 'enum', enum: AuditAction })
  action!: AuditAction;

  @Column({ type: 'jsonb' })
  detail!: Record<string, any>;

  @Column({ name: 'ip_address', length: 45 }) // IPv6 대응을 위해 넉넉하게 45
  ipAddress!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createAt!: Date;

  @ManyToOne(() => Auth, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'auth_id' })
  auth!: Auth | null;
}
