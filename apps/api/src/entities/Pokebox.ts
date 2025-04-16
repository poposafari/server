import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { Account } from "./Account";
import { Backgrounds, PokemonGender, PokemonSkill } from "../enums";

@Entity({ schema: "db0", name: "pokebox" })
@Index("idx_account_box", ["account_id", "box"])
export class Pokebox {
  @PrimaryColumn()
  account_id!: number;

  @PrimaryColumn({ type: "char", length: 4 })
  pokedex!: string;

  @PrimaryColumn({
    type: "enum",
    enum: PokemonGender,
    default: PokemonGender.NONE,
  })
  gender!: PokemonGender;

  @Column({ type: "int", default: 1 })
  count!: number;

  @Column({
    type: "enum",
    enum: Backgrounds,
  })
  box!: Backgrounds;

  @Column({ type: "boolean", default: false })
  shiny!: boolean;

  @Column({ type: "int", default: 0 })
  form!: number;

  @Column({
    type: "enum",
    enum: PokemonSkill,
    array: true,
    nullable: false,
  })
  skill!: PokemonSkill[];

  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  capture_date!: Date;

  @Column({ type: "char", length: 3, default: "000" })
  capture_location!: string;

  @Column({ type: "char", length: 3, default: "001" })
  capture_ball!: string;

  @Column({ type: "boolean", default: false })
  in_party!: boolean;

  @Column({ type: "varchar", length: 10, nullable: true })
  nickname?: string;

  @ManyToOne(() => Account, (account) => account.id, { onDelete: "CASCADE" })
  @JoinColumn({ name: "account_id" })
  account?: Account;
}
