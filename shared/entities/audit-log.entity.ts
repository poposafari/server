import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { AuditAction } from 'shared/types/etc.type';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Index()
  @Column({ name: 'user_id', type: 'bigint' })
  userId!: string;

  @Column({ type: 'varchar' })
  action!: AuditAction;

  @Column({ type: 'jsonb' })
  detail!: any;

  @Column({ name: 'ip_address' })
  ipAddress!: string;

  @CreateDateColumn({ name: 'create_at' })
  createdAt!: Date;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
