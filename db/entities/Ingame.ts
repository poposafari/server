import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Unique,
  ManyToOne,
  JoinColumn,
  OneToOne,
} from "typeorm";
import { Account } from "./Account";
import { ItemSlot } from "./ItemSlot";
import { PartySlot } from "./PartySlot";
import { PokeboxBg } from "./PokeboxBg";

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

  @OneToOne(() => ItemSlot, (itemSlot) => itemSlot.account, {
    onDelete: "CASCADE",
  })
  itemSlot?: ItemSlot;

  @OneToOne(() => PartySlot, (partySlot) => partySlot.account, {
    onDelete: "CASCADE",
  })
  partySlot?: PartySlot;

  @OneToOne(() => PokeboxBg, (pokeboxBg) => pokeboxBg.account, {
    onDelete: "CASCADE",
  })
  pokeboxBg?: PokeboxBg;

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
