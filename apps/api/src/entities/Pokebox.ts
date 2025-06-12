import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index, Unique, Check } from 'typeorm';
import { Account } from './Account';
import { PokemonGender, PokemonSkill } from '../utils/type';

@Entity({ schema: 'db0', name: 'pokebox' })
@Index('idx_account_box', ['account_id', 'box'])
@Check(`"box" >= 0 AND "box" <= 32`)
@Unique('uq_pokebox', ['account_id', 'pokedex', 'gender'])
export class Pokebox {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  idx!: number;

  @Column()
  account_id!: number;

  @Column({ type: 'char', length: 4, default: '0000' })
  pokedex!: string;

  @Column({
    type: 'enum',
    enum: PokemonGender,
    default: PokemonGender.NONE,
  })
  gender!: PokemonGender;

  @Column({ type: 'int', default: 1 })
  count!: number;

  @Column({ type: 'int', default: 0 })
  box!: number;

  @Column({ type: 'boolean', default: false })
  shiny!: boolean;

  @Column({ type: 'int', default: 0 })
  form!: number;

  @Column({
    type: 'enum',
    enum: PokemonSkill,
    array: true,
  })
  skill!: PokemonSkill[];

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  capture_date!: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  update_date!: Date;

  @Column({ type: 'char', length: 3, default: '000' })
  capture_location!: string;

  @Column({ type: 'char', length: 3, default: '001' })
  capture_ball!: string;

  @Column({ type: 'boolean', default: false })
  in_party!: boolean;

  @Column({ type: 'varchar', length: 10, nullable: true })
  nickname?: string;

  @ManyToOne(() => Account, (account) => account.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account?: Account;
}
