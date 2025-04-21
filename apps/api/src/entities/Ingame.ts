import {
  Entity,
  PrimaryColumn,
  Column,
  Unique,
  OneToOne,
  JoinColumn,
  Check,
} from "typeorm";
import { Account } from "./Account";
import { IngameAvatar, IngameGender, Backgrounds } from "../enums";

@Entity({ schema: "db0", name: "ingame" })
@Unique(["nickname"])
@Check(`"available_ticket" >= 0 AND "available_ticket" <= 8`)
@Check(`array_length(boxes, 1) = 33`)
@Check(`array_length(party, 1) <= 6`)
@Check(`array_length(itemslot, 1) <= 9`)
export class Ingame {
  @PrimaryColumn()
  account_id!: number;

  @OneToOne(() => Account, { onDelete: "CASCADE" })
  @JoinColumn({ name: "account_id" })
  account?: Account;

  @Column({ type: "char", length: 3 })
  location!: string;

  @Column()
  x!: number;

  @Column()
  y!: number;

  @Column({
    type: "enum",
    enum: IngameGender,
  })
  gender!: IngameGender;

  @Column({
    type: "enum",
    enum: IngameAvatar,
  })
  avatar!: IngameAvatar;

  @Column({ type: "varchar", length: 10, unique: true })
  nickname!: string;

  @Column()
  money!: number;

  @Column({ type: "int", default: 8 })
  available_ticket!: number;

  @Column({
    type: "enum",
    enum: Backgrounds,
    array: true,
  })
  boxes!: Backgrounds[];

  @Column({
    type: "text",
    array: true,
  })
  party!: string[];

  @Column({
    type: "char",
    length: 3,
    array: true,
  })
  itemslot!: string[];
}
