import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { UserAuthProvider } from 'shared/types';

@Entity('auth_identities')
@Index(['provider', 'providerId'], { unique: true })
export class AuthIdentity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'user_id', type: 'bigint' })
  userId!: string;

  @Column({ type: 'varchar' })
  provider!: UserAuthProvider;

  @Column({
    name: 'provider_id',
    comment:
      'local이라면 로그인 아이디가 되고, google이라면 구글이 준 고유한 ID인 sub를 넣으면 됨.',
  })
  providerId!: string;

  @Column({ nullable: true, select: false, comment: '비밀번호는 기본 조회에서 제외' })
  password?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'last_login_at' })
  lastLoginAt!: Date;

  @ManyToOne(() => User, (user) => user.identities, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
