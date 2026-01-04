import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from './user.entity';

@Entity('user_pokemons')
@Index(['userId', 'box'], { unique: true })
export class UserPokemon {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'user_id', type: 'bigint' })
  userId!: string;

  @Column({ name: 'pokemon_id', comment: '도감 번호 (ex. "0001")' })
  pokemonId!: string;

  @Column({ type: 'int', comment: '박스 번호' })
  box!: number;

  @Column({ type: 'int', comment: '그리드 위치' })
  grid!: number;

  @ManyToOne(() => User, (user) => user.pokemons, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
