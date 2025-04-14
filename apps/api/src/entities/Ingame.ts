import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Unique,
  OneToOne,
  Check,
} from "typeorm";
import { Account } from "./Account";
import { ItemSlot } from "./ItemSlot";
import { PartySlot } from "./PartySlot";
import { PokeboxBg } from "./PokeboxBg";
import { IngameAvatar, IngameGender } from "../enums";

@Entity({ schema: "db0", name: "ingame" })
@Unique(["nickname"])
@Check(`"available_ticket" >= 0 AND "available_ticket" <= 8`)
export class Ingame {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column()
  account_id?: number;

  @OneToOne(() => Account, (account) => account.id, { onDelete: "CASCADE" })
  account?: Account;

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

  @Column({ type: "int", default: 8 })
  available_ticket!: number;
}
