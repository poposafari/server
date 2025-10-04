import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { Account } from './Account';

@Entity({ schema: 'db', name: 'account_local' })
export class AccountLocal {
  @PrimaryColumn()
  account_id!: number;

  @Column({ type: 'varchar', length: 20, unique: true })
  username!: string;

  @Column({ type: 'varchar', length: 100 })
  password!: string;

  @Column({ type: 'varchar', length: 100, unique: true, nullable: true })
  email!: string;

  @OneToOne(() => Account, (account) => account.local, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account!: Account;
}
