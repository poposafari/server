import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from './user.entity';

@Entity('user_costumes')
@Index(['userId', 'costumeId'], { unique: true })
export class UserCostume {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'user_id', type: 'bigint' })
  userId!: string;

  @Column({ name: 'costume_id', comment: '코스튬 코드 (ex. "hair_01")' })
  costumeId!: string;

  @ManyToOne(() => User, (user) => user.costumes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
