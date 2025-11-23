import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Account } from './Account';

@Entity({ schema: 'db', name: 'last_grounditem' })
export class LastGroundItem {
  @PrimaryGeneratedColumn()
  idx!: number;

  @ManyToOne(() => Account, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account!: Account;

  @Column({ type: 'varchar', length: 4 })
  location!: string;

  @Column({ type: 'varchar', length: 3 })
  item!: string;

  @Column({ type: 'integer' })
  stock!: number;

  @Column({ type: 'boolean' })
  capture!: boolean;

  @Column({ type: 'timestamptz', name: 'spawn' })
  spawn!: Date;

  @Column({ type: 'timestamptz', name: 'despawn' })
  despawn!: Date;
}
