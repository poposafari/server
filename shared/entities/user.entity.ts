import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { UserAvatarData, UserLocationData, UserPcSettingsData } from 'shared/types';
import { AuthIdentity } from './auth-identity.entity';
import { UserPokemon } from './user-pokemon.entity';
import { UserBag } from './user-bag.entity';
import { UserCostume } from './user-costume.entity';
import { UserPokedex } from './user-pokedex.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ unique: true })
  nickname!: string;

  @Column({ type: 'int', default: 0 })
  money!: number;

  @Column({ type: 'int', default: 0 })
  candy!: number;

  @Column({ name: 'play_time', type: 'int', default: 0 })
  playTime!: number;

  @Column({ name: 'is_newbie', default: true })
  isNewbie!: boolean;

  @Column({ name: 'is_deleted', default: false })
  isDelete!: boolean;

  @Column({
    name: 'last_location',
    type: 'jsonb',
  })
  lastLocation!: UserLocationData;

  @Column({
    name: 'last_avatar',
    type: 'jsonb',
    default: {
      skin: 0,
      eye: 0,
      hair: 0,
      top: 0,
      bottom: 0,
      shoes: 0,
      etc_1: 0,
      etc_2: 0,
      etc_3: 0,
    },
  })
  lastAvatar!: UserAvatarData;

  @Column({
    name: 'last_party',
    type: 'text',
    array: true,
    default: [],
    comment: '보유 포켓몬의 UserPokemon.id 리스트',
  })
  lastParty!: string[];

  @Column({
    name: 'last_quickslot',
    type: 'text',
    array: true,
    default: [],
    comment: '보유 아이템의 UserItem.id 리스트',
  })
  lastQuickslot!: string[];

  @Column({
    name: 'pc_settings',
    type: 'jsonb',
    default: { background: [], name: [] },
  })
  pcSettings!: UserPcSettingsData;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @OneToMany(() => AuthIdentity, (auth) => auth.user)
  identities!: AuthIdentity[];

  @OneToMany(() => UserPokemon, (pokemon) => pokemon.user)
  pokemons!: UserPokemon[];

  @OneToMany(() => UserBag, (bag) => bag.user)
  bags!: UserBag[];

  @OneToMany(() => UserCostume, (costume) => costume.user)
  costumes!: UserCostume[];

  @OneToMany(() => UserPokedex, (pokedex) => pokedex.user)
  pokedex!: UserPokedex[];
}
