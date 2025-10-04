import { Check, Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Account } from './Account';
import { ItemCategory } from '../shared/enums';

@Entity({ schema: 'db', name: 'bag' })
@Check(`"stock" >= 0 AND "stock" <= 999`)
@Check(`CASE WHEN "category" = 'key' THEN "stock" = 1 ELSE TRUE END`)
export class Bag {
  @PrimaryGeneratedColumn()
  idx!: number;

  @ManyToOne(() => Account, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account!: Account;

  @Column({ type: 'varchar', length: 3 })
  item!: string;

  @Column({ type: 'enum', enum: ItemCategory })
  category!: ItemCategory;

  @Column({ type: 'integer', default: 1 })
  stock!: number;
}
