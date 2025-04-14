import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { Account } from "./Account";
import { ItemType } from "../enums";

@Entity({ schema: "db0", name: "bag" })
export class Bag {
  @PrimaryColumn()
  account_id!: number;

  @PrimaryColumn({ type: "char", length: 3 })
  item!: string;

  @Column({ type: "enum", enum: ItemType, enumName: "item_type" })
  category?: ItemType;

  @Column({ type: "int", default: 0 })
  stock!: number;

  @ManyToOne(() => Account, (account) => account.id, { onDelete: "CASCADE" })
  @JoinColumn({ name: "account_id" })
  account?: Account;
}
