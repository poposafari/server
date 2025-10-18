import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Account } from './Account';
import { PokemonGender, PokemonSkill } from '../shared/enums';

@Entity({ schema: 'db', name: 'pc' })
export class PC {
  @PrimaryGeneratedColumn()
  idx!: number;

  @ManyToOne(() => Account, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account!: Account;

  @Column({ type: 'integer' })
  box!: number;

  @Column({ type: 'varchar', length: 4 })
  pokedex!: string;

  @Column({ type: 'enum', enum: PokemonGender })
  gender!: PokemonGender;

  @Column({ type: 'integer', default: 1 })
  count!: number;

  @Column({ type: 'boolean' })
  shiny!: boolean;

  @Column({ type: 'varchar', length: 10, nullable: true })
  form!: string;

  @Column({ type: 'enum', enum: PokemonSkill, array: true, nullable: true })
  skill!: PokemonSkill[];

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @Column({ type: 'varchar', length: 4, nullable: false, name: 'created_location' })
  createdLocation!: string;

  @Column({ type: 'varchar', length: 4, nullable: true, name: 'updated_location' })
  updatedLocation!: string;

  @Column({ type: 'varchar', length: 3, nullable: false, name: 'created_ball' })
  createdBall!: string;

  @Column({ type: 'varchar', length: 3, nullable: true, name: 'updated_ball' })
  updatedBall!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  nickname!: string;
}
