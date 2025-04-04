import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";
import { Account } from "./Account";

@Entity({ schema: "db0", name: "item_slot" })
export class ItemSlot {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column()
  account_id?: number;

  @ManyToOne(() => Account, (account) => account.id, { onDelete: "CASCADE" })
  @JoinColumn({ name: "account_id" })
  account?: Account;

  @Column({ type: "char", length: 3, nullable: true, default: null })
  slot1?: string;

  @Column({ type: "char", length: 3, nullable: true, default: null })
  slot2?: string;

  @Column({ type: "char", length: 3, nullable: true, default: null })
  slot3?: string;

  @Column({ type: "char", length: 3, nullable: true, default: null })
  slot4?: string;

  @Column({ type: "char", length: 3, nullable: true, default: null })
  slot5?: string;

  @Column({ type: "char", length: 3, nullable: true, default: null })
  slot6?: string;

  @Column({ type: "char", length: 3, nullable: true, default: null })
  slot7?: string;

  @Column({ type: "char", length: 3, nullable: true, default: null })
  slot8?: string;

  @Column({ type: "char", length: 3, nullable: true, default: null })
  slot9?: string;
}
