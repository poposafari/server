import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from './user.entity';

export enum PokedexStatus {
  SEEN = 'SEEN',
  CAUGHT = 'CAUGHT',
}

@Entity('user_pokedexs')
@Index(['userId', 'pokemonId'], { unique: true })
export class UserPokedex {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'user_id', type: 'bigint' })
  userId!: string;

  @Column({ name: 'pokemon_id', comment: '도감 번호(ex."0001")' })
  pokemonId!: string;

  @Column({ type: 'varchar' })
  status!: PokedexStatus;

  @Column({ name: 'cnt_seen', type: 'int', default: 0 })
  cntSeen!: number;

  @Column({ name: 'cnt_caught', type: 'int', default: 0 })
  cntCaught!: number;

  @ManyToOne(() => User, (user) => user.pokedex, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
