import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Unique,
} from "typeorm";

@Entity({ schema: "db0", name: "account" })
@Unique(["provider", "provider_id"])
export class Account {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({ type: "varchar", length: 20, nullable: true, unique: true })
  username?: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  password?: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  email?: string;

  @Column({ type: "varchar", length: 20, nullable: true })
  provider?: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  provider_id?: string;

  @CreateDateColumn({ type: "timestamp" })
  created?: Date;
}
