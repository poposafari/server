import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { PokemonGender, PokemonSkill } from '../utils/type';
import { Account } from './Account';

@Entity({ schema: 'db0', name: 'wild' })
export class Wild {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  idx!: number;

  @Column()
  account_id!: number;

  @Column()
  overworld!: string;

  @Column()
  pokedex!: string;

  @Column({
    type: 'enum',
    enum: PokemonGender,
  })
  gender!: PokemonGender;

  @Column({ type: 'boolean', default: false })
  shiny!: boolean;

  @Column({
    type: 'enum',
    enum: PokemonSkill,
    nullable: true,
  })
  skills!: PokemonSkill | null;

  @Column({ type: 'int', default: 0 })
  form!: number;

  @Column()
  catch!: boolean;

  @Column()
  spawns!: string;

  @ManyToOne(() => Account, (account) => account.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account?: Account;
}
