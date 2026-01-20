import { Column, CreateDateColumn, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { Auth } from './auth.entity';
import { UserAvatarData, UserGender, UserLocationData, UserPcSettingsData } from '../types';

@Entity('users')
export class User {
  @PrimaryColumn({ name: 'auth_id', type: 'bigint' })
  authId!: string;

  @OneToOne(() => Auth, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'auth_id' })
  auth!: Auth;

  @Column({ type: 'varchar', length: 20, unique: true, comment: '인게임 표시용 닉네임' })
  nickname!: string;

  @Column({ type: 'int', default: 0 })
  money!: number;

  @Column({ type: 'int', default: 0 })
  candy!: number;

  @Column({ name: 'play_time', type: 'int', default: 0 })
  playTime!: number;

  @Column({ name: 'is_newbie', type: 'boolean', default: true })
  isNewbie!: boolean;

  @Column({ name: 'gender', type: 'varchar' })
  gender!: UserGender;

  @Column({
    name: 'last_location',
    type: 'jsonb',
    default: null,
  })
  lastLocation!: UserLocationData;

  @Column({
    name: 'last_avatar',
    type: 'jsonb',
    default: {
      skin: 'skin_0',
      eye: 'eye_0',
      hair: 'hair_0',
      top: 'top_0',
      bottom: 'bottom_0',
      shoes: 'shoes_0',
      etc_1: 'etc_1_0',
      etc_2: 'etc_2_0',
      etc_3: 'etc_3_0',
    },
  })
  lastAvatar!: UserAvatarData;

  @Column({
    name: 'last_party',
    type: 'bigint',
    array: true,
    default: [],
    comment: '사용자가 데리고 다니는 포켓몬(user_pokemons)의 ID 목록',
  })
  lastParty!: string[];

  @Column({
    name: 'last_quickslot',
    type: 'bigint',
    array: true,
    default: [],
    comment: '퀵슬롯에 등록된 아이템/도구 고유 ID 목록',
  })
  lastQuickslot!: string[];

  @Column({
    name: 'last_townmap',
    type: 'varchar',
    array: true,
    default: [],
  })
  lastTownmap!: string[];

  @Column({
    name: 'pc_settings',
    type: 'jsonb',
    default: { background: [], name: [] },
    comment: 'PC 박스 배경 및 이름 설정',
  })
  pcSettings!: UserPcSettingsData;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
