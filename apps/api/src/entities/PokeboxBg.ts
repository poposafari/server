import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";
import { Account } from "./Account";

export enum Backgrounds {
  ZERO = "0",
  ONE = "1",
  TWO = "2",
  THREE = "3",
  FOUR = "4",
  FIVE = "5",
  SIX = "6",
  SEVEN = "7",
  EIGHT = "8",
  NINE = "9",
  TEN = "10",
  ELEVEN = "11",
  TWELVE = "12",
  THIRTEEN = "13",
  FOURTEEN = "14",
  FIFTEEN = "15",
  SIXTEEN = "16",
  SEVENTEEN = "17",
  EIGHTEEN = "18",
}

@Entity({ schema: "db0", name: "pokebox_bg" })
export class PokeboxBg {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column()
  account_id?: number;

  @ManyToOne(() => Account, (account) => account.id, { onDelete: "CASCADE" })
  @JoinColumn({ name: "account_id" })
  account?: Account;

  @Column({
    type: "enum",
    enum: Backgrounds,
    default: Backgrounds.ZERO,
  })
  box0?: string;

  @Column({
    type: "enum",
    enum: Backgrounds,
    default: Backgrounds.ZERO,
  })
  box1?: string;

  @Column({
    type: "enum",
    enum: Backgrounds,
    default: Backgrounds.ZERO,
  })
  box2?: string;

  @Column({
    type: "enum",
    enum: Backgrounds,
    default: Backgrounds.ZERO,
  })
  box3?: string;

  @Column({
    type: "enum",
    enum: Backgrounds,
    default: Backgrounds.ZERO,
  })
  box4?: string;

  @Column({
    type: "enum",
    enum: Backgrounds,
    default: Backgrounds.ZERO,
  })
  box5?: string;

  @Column({
    type: "enum",
    enum: Backgrounds,
    default: Backgrounds.ZERO,
  })
  box6?: string;

  @Column({
    type: "enum",
    enum: Backgrounds,
    default: Backgrounds.ZERO,
  })
  box7?: string;

  @Column({
    type: "enum",
    enum: Backgrounds,
    default: Backgrounds.ZERO,
  })
  box8?: string;

  @Column({
    type: "enum",
    enum: Backgrounds,
    default: Backgrounds.ZERO,
  })
  box9?: string;

  @Column({
    type: "enum",
    enum: Backgrounds,
    default: Backgrounds.ZERO,
  })
  box10?: string;

  @Column({
    type: "enum",
    enum: Backgrounds,
    default: Backgrounds.ZERO,
  })
  box11?: string;

  @Column({
    type: "enum",
    enum: Backgrounds,
    default: Backgrounds.ZERO,
  })
  box12?: string;

  @Column({
    type: "enum",
    enum: Backgrounds,
    default: Backgrounds.ZERO,
  })
  box13?: string;

  @Column({
    type: "enum",
    enum: Backgrounds,
    default: Backgrounds.ZERO,
  })
  box14?: string;

  @Column({
    type: "enum",
    enum: Backgrounds,
    default: Backgrounds.ZERO,
  })
  box15?: string;

  @Column({
    type: "enum",
    enum: Backgrounds,
    default: Backgrounds.ZERO,
  })
  box16?: string;

  @Column({
    type: "enum",
    enum: Backgrounds,
    default: Backgrounds.ZERO,
  })
  box17?: string;

  @Column({
    type: "enum",
    enum: Backgrounds,
    default: Backgrounds.ZERO,
  })
  box18?: string;
}
