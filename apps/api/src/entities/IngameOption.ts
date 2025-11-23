import { Check, Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { Account } from './Account';
import { TextSpeed } from '../shared/enums';

@Entity({ schema: 'db', name: 'ingame_option' })
@Check(`"frame" >= 0 AND "frame" <= 10`)
@Check(`"background_volume" >= 0 AND "background_volume" <= 10`)
@Check(`"effect_volume" >= 0 AND "effect_volume" <= 10`)
export class IngameOption {
  @PrimaryColumn()
  account_id!: number;

  @OneToOne(() => Account, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'account_id' })
  account!: Account;

  @Column({
    type: 'integer',
    default: TextSpeed.MID,
    name: 'text_speed',
  })
  textSpeed!: TextSpeed;

  @Column({ type: 'integer', default: 0 })
  frame!: number;

  @Column({ type: 'integer', default: 5, name: 'background_volume' })
  backgroundVolume!: number;

  @Column({ type: 'integer', default: 5, name: 'effect_volume' })
  effectVolume!: number;

  @Column({ type: 'boolean', default: true, name: 'tutorial' })
  tutorial!: boolean;
}
