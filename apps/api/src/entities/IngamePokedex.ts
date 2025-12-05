import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { Account } from './Account';

@Entity({ schema: 'db', name: 'ingame_pokedex' })
export class IngamePokedex {
  @PrimaryColumn()
  account_id!: number;

  @OneToOne(() => Account, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'account_id' })
  account!: Account;

  @Column({ type: 'integer', array: true, default: () => 'ARRAY[]::INTEGER[]', name: 'gen_1' })
  gen1!: number[];

  @Column({ type: 'integer', array: true, default: () => 'ARRAY[]::INTEGER[]', name: 'gen_2' })
  gen2!: number[];

  @Column({ type: 'integer', array: true, default: () => 'ARRAY[]::INTEGER[]', name: 'gen_3' })
  gen3!: number[];

  @Column({ type: 'integer', array: true, default: () => 'ARRAY[]::INTEGER[]', name: 'gen_4' })
  gen4!: number[];

  @Column({ type: 'integer', array: true, default: () => 'ARRAY[]::INTEGER[]', name: 'gen_5' })
  gen5!: number[];

  @Column({ type: 'integer', array: true, default: () => 'ARRAY[]::INTEGER[]', name: 'gen_6' })
  gen6!: number[];

  @Column({ type: 'integer', array: true, default: () => 'ARRAY[]::INTEGER[]', name: 'gen_7' })
  gen7!: number[];

  @Column({ type: 'integer', array: true, default: () => 'ARRAY[]::INTEGER[]', name: 'gen_8' })
  gen8!: number[];

  @Column({ type: 'integer', array: true, default: () => 'ARRAY[]::INTEGER[]', name: 'gen_9' })
  gen9!: number[];
}
