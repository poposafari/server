import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from './user.entity';

@Entity('user_bags')
@Index(['userId', 'itemId'], { unique: true })
export class UserBag {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'user_id', type: 'bigint' })
  userId!: string;

  @Column({ name: 'item_id', comment: '아이템 코드 (ex. "poke-ball")' })
  itemId!: string;

  @Column({ type: 'int' })
  quantity!: number;

  @ManyToOne(() => User, (user) => user.bags, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
