import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

@Entity('auth_identities')
@Index(['provider', 'providerId'], { unique: true })
export class Auth {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ comment: "'local', 'google', 'discord'" })
  provider!: string;

  @Column({ name: 'provider_id', comment: 'Login ID or Social Sub ID' })
  providerId!: string;

  @Column({ nullable: true, select: false })
  password?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt?: Date;

  @Column({ name: 'last_login_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  lastLoginAt!: Date;
}
