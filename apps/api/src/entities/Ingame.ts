import { Check, Column, CreateDateColumn, Entity, JoinColumn, OneToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { Account } from './Account';
import { PC } from './PC';
import { PlayerGender } from '../shared/enums';

@Entity({ schema: 'db', name: 'ingame' })
@Check(`"available_ticket" >= 0 AND "available_ticket" <= 4`)
@Check(`"candy" >= 0 AND "candy" <= 99999999`)
@Check(`"avatar" >= 1 AND "avatar" <= 4`)
export class Ingame {
  @PrimaryColumn()
  account_id!: number;

  @OneToOne(() => Account, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account!: Account;

  @Column({ type: 'varchar', length: 20, unique: true })
  nickname!: string;

  @Column({ type: 'integer', default: 0 })
  x!: number;

  @Column({ type: 'integer', default: 0 })
  y!: number;

  @Column({ type: 'varchar', length: 4 })
  location!: string;

  @Column({ type: 'enum', enum: PlayerGender })
  gender!: PlayerGender;

  @Column({ type: 'integer' })
  avatar!: number;

  @Column({ type: 'integer', default: 4, name: 'available_ticket' })
  availableTicket!: number;

  @Column({ type: 'integer', default: 0 })
  candy!: number;

  @Column({ type: 'integer', default: 0, name: 'money' })
  money!: number;

  @OneToOne(() => PC, { nullable: true, onDelete: 'SET NULL' })
  pc!: PC;

  @Column({ type: 'integer', array: true, default: () => 'ARRAY[null, null, null, null, null, null]::INTEGER[]' })
  party!: number[];

  @Column({ type: 'integer', array: true, default: () => 'ARRAY[null, null, null, null, null]::INTEGER[]', name: 'slot_item' })
  slotItem!: number[];

  @Column({ type: 'integer', array: true, default: () => 'ARRAY_FILL(0, ARRAY[33])', name: 'pc_bg' })
  pcBg!: number[];

  @Column({ type: 'varchar', length: 30, array: true, default: () => `ARRAY_FILL(''::VARCHAR, ARRAY[33])`, name: 'pc_name' })
  pcName!: string[];

  @Column({ type: 'integer', array: true, default: () => 'ARRAY_FILL(0, ARRAY[33])', name: 'pc_cnt' })
  pcCnt!: number[];

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @Column({ type: 'integer', default: 0, name: 'playtime' })
  playtime!: number;

  @Column({ type: 'varchar', length: 4, array: true, default: () => 'ARRAY[]::VARCHAR(4)[]', name: 'discovered_locations' })
  discoveredLocations!: string[];

  @Column({ type: 'boolean', default: true, name: 'is_starter_0' })
  isStarter0!: boolean;

  @Column({ type: 'boolean', default: true, name: 'is_starter_1' })
  isStarter1!: boolean;
}
