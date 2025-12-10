import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Account } from './Account';
import { PokemonGender, PokemonSkill, WildSpawn } from '../shared/enums';

@Entity({ schema: 'db', name: 'last_wild' })
export class LastWild {
  @PrimaryGeneratedColumn()
  idx!: number;

  @ManyToOne(() => Account, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account!: Account;

  @Column({ type: 'varchar', length: 4 })
  location!: string;

  @Column({ type: 'varchar', length: 4 })
  pokedex!: string;

  @Column({ type: 'enum', enum: PokemonGender })
  gender!: PokemonGender;

  @Column({ type: 'boolean' })
  shiny!: boolean;

  @Column({ type: 'varchar', length: 10, nullable: true })
  form!: string;

  @Column({ type: 'enum', enum: PokemonSkill, array: true, nullable: true })
  skill!: PokemonSkill[];

  @Column({ type: 'boolean' })
  capture!: boolean;

  @Column({ type: 'enum', enum: WildSpawn, name: 'spawn_type' })
  spawnType!: WildSpawn;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'eaten_berry' })
  eatenBerry!: string | null;

  @Column({ type: 'varchar', length: 10 })
  region!: string;

  @Column({ type: 'timestamptz', name: 'spawn' })
  spawn!: Date;

  @Column({ type: 'timestamptz', name: 'despawn' })
  despawn!: Date;
}
