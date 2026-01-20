import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PokemonGender } from '../types';
import { Auth } from './auth.entity';

@Entity('user_pokemons')
@Index('idx_unique_user_pokemon_gender', ['authId', 'pokemonId', 'gender'], { unique: true })
@Index('idx_perf_user_box', ['authId', 'box'])
export class UserPokemon {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'auth_id', type: 'bigint' })
  authId!: string;

  @Column({ name: 'pokemon_id', type: 'varchar', nullable: false, comment: '포켓몬 도감 번호' })
  pokemonId!: string;

  @Column({ type: 'int', nullable: false, comment: '박스 번호' })
  box!: number;

  @Column({
    type: 'enum',
    enum: PokemonGender,
    default: PokemonGender.NONE,
    comment: '0=NONE, 1=MALE, 2=FEMALE',
  })
  gender!: PokemonGender;

  @Column({ name: 'catch_count', type: 'int', nullable: false, comment: '포획한 횟수', default: 1 })
  @Check(`"catch_count" >= 1 AND "catch_count" <= 999999999`)
  catchCount!: number;

  @Column({
    name: 'friend_ship',
    type: 'int',
    default: 0,
    nullable: false,
  })
  @Check(`"friend_ship" >= 0 AND "friend_ship" <= 255`)
  friendShip!: number;

  @Column({ type: 'boolean', nullable: false })
  shiny!: boolean;

  @Column({
    name: 'entered_box_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
    comment: '해당 박스로 이동하거나 처음 잡은 시간 (정렬 기준)',
  })
  enteredBoxAt!: Date;

  @ManyToOne(() => Auth, (auth) => auth.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'auth_id' })
  auth!: Auth;
}
