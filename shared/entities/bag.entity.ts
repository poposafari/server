import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Auth } from './auth.entity';

@Entity('user_bags')
@Index(['authId', 'itemId'], { unique: true })
export class UserBag {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'auth_id', type: 'bigint', nullable: false })
  authId!: string;

  @Column({ name: 'item_id', type: 'varchar', nullable: false })
  itemId!: string;

  @Column({ type: 'int', nullable: false, default: 1 })
  @Check(`"quantity" >= 1 AND "quantity" <= 999`)
  quantity!: number;

  @ManyToOne(() => Auth, (auth) => auth.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'auth_id' })
  auth!: Auth;
}
