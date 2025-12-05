import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { Account } from './Account';

@Entity({ schema: 'db', name: 'ingame_costume' })
export class IngameCostume {
  @PrimaryColumn()
  account_id!: number;

  @OneToOne(() => Account, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'account_id' })
  account!: Account;

  @Column({ type: 'integer', default: 1 })
  skin!: number;

  @Column({ type: 'integer', default: 1 })
  eyes!: number;

  @Column({ type: 'integer', default: 1 })
  hair!: number;

  @Column({ type: 'integer', default: 1 })
  top!: number;

  @Column({ type: 'integer', default: 1 })
  bottom!: number;

  @Column({ type: 'integer', default: 1 })
  shoes!: number;

  @Column({ type: 'integer', default: 1, name: 'accessory_0' })
  accessory0!: number;

  @Column({ type: 'integer', default: 1, name: 'accessory_1' })
  accessory1!: number;

  @Column({ type: 'integer', default: 1, name: 'accessory_2' })
  accessory2!: number;

  @Column({ type: 'integer', default: 1, name: 'accessory_3' })
  accessory3!: number;
}
