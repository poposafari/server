import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Auth } from './auth.entity';

@Entity('user_costumes')
@Index(['authId', 'costumeId'], { unique: true })
export class UserCostume {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'auth_id', type: 'bigint', nullable: false })
  authId!: string;

  @Column({ name: 'costume_id', type: 'varchar', nullable: false })
  costumeId!: string;

  @ManyToOne(() => Auth, (auth) => auth.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'auth_id' })
  auth!: Auth;
}
