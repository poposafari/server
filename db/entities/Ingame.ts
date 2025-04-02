import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Unique,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Account } from "./Account";

export enum IngameGender {
  BOY = "boy",
  GIRL = "girl",
}

export enum IngameAvatar {
  ONE = "1",
  TWO = "2",
  THREE = "3",
  FOUR = "4",
}

@Entity({ schema: "db0", name: "ingame" })
@Unique(["nickname"])
export class Ingame {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column()
  account_id?: number;

  @ManyToOne(() => Account, (account) => account.id, { onDelete: "CASCADE" })
  @JoinColumn({ name: "account_id" })
  account?: Account;

  @Column({ type: "char", length: 3 })
  location?: string;

  @Column()
  x?: number;

  @Column()
  y?: number;

  @Column({
    type: "enum",
    enum: IngameGender,
  })
  gender?: IngameGender;

  @Column({
    type: "enum",
    enum: IngameAvatar,
  })
  avatar?: IngameAvatar;

  @Column({ type: "varchar", length: 10, unique: true })
  nickname?: string;

  @Column()
  money?: number;
}
