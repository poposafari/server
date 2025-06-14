import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';
import { Account } from './Account';

@Entity({ schema: 'db0', name: 'grounditem' })
export class Grounditem {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  idx!: number;

  @Column()
  account_id!: number;

  @Column()
  overworld!: string;

  @Column({ type: 'char', length: 3 })
  item!: string;

  @Column()
  stock!: number;

  @Column()
  catch!: boolean;

  @ManyToOne(() => Account, (account) => account.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account?: Account;
}
