import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";
import { Account } from "./Account";

@Entity({ schema: "db0", name: "party_slot" })
export class PartySlot {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column()
  account_id?: number;

  @ManyToOne(() => Account, (account) => account.id, { onDelete: "CASCADE" })
  @JoinColumn({ name: "account_id" })
  account?: Account;

  @Column({ type: "char", length: 3, default: "000" })
  slot1?: string;

  @Column({ type: "char", length: 3, default: "000" })
  slot2?: string;

  @Column({ type: "char", length: 3, default: "000" })
  slot3?: string;

  @Column({ type: "char", length: 3, default: "000" })
  slot4?: string;

  @Column({ type: "char", length: 3, default: "000" })
  slot5?: string;

  @Column({ type: "char", length: 3, default: "000" })
  slot6?: string;
}
