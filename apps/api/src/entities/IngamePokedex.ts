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

  @Column({ type: 'varchar', length: 20, array: true, default: () => 'ARRAY[]::VARCHAR(20)[]', name: 'gen_1' })
  gen1!: string[];

  @Column({ type: 'varchar', length: 20, array: true, default: () => 'ARRAY[]::VARCHAR(20)[]', name: 'gen_2' })
  gen2!: string[];

  @Column({ type: 'varchar', length: 20, array: true, default: () => 'ARRAY[]::VARCHAR(20)[]', name: 'gen_3' })
  gen3!: string[];

  @Column({ type: 'varchar', length: 20, array: true, default: () => 'ARRAY[]::VARCHAR(20)[]', name: 'gen_4' })
  gen4!: string[];

  @Column({ type: 'varchar', length: 20, array: true, default: () => 'ARRAY[]::VARCHAR(20)[]', name: 'gen_5' })
  gen5!: string[];

  @Column({ type: 'varchar', length: 20, array: true, default: () => 'ARRAY[]::VARCHAR(20)[]', name: 'gen_6' })
  gen6!: string[];

  @Column({ type: 'varchar', length: 20, array: true, default: () => 'ARRAY[]::VARCHAR(20)[]', name: 'gen_7' })
  gen7!: string[];

  @Column({ type: 'varchar', length: 20, array: true, default: () => 'ARRAY[]::VARCHAR(20)[]', name: 'gen_8' })
  gen8!: string[];

  @Column({ type: 'varchar', length: 20, array: true, default: () => 'ARRAY[]::VARCHAR(20)[]', name: 'gen_9' })
  gen9!: string[];
}
