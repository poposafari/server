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

  @Column({ name: 'auth_id', type: 'bigint' })
  authId!: string;

  @Column({ type: 'enum', enum: AuditAction })
  action!: AuditAction;

  @Column({ type: 'jsonb' })
  detail!: Record<string, any>;

  @Column({ name: 'ip_address', length: 45 }) // IPv6 대응을 위해 넉넉하게 45
  ipAddress!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createAt!: Date;

  @ManyToOne(() => Auth, { onDelete: 'CASCADE' }) // 유저 삭제되면 로그도 삭제할지, 남길지 결정 필요 (보통 로그는 남김: NO ACTION or SET NULL)
  @JoinColumn({ name: 'auth_id' })
  auth!: Auth;
}
