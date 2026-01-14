import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Index,
  OneToOne,
  OneToMany,
} from 'typeorm';

@Entity('auth_identities')
@Index(['provider', 'providerId'], { unique: true })
export class Auth {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ comment: "'local', 'google', 'discord'" })
  provider!: string;

  @Column({ name: 'provider_id', comment: 'Login ID or Social Sub ID' })
  providerId!: string;

  @Column({ nullable: true, select: false })
  password?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt?: Date;

  @Column({ name: 'last_login_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  lastLoginAt!: Date;

  // --- Relations ---

  //   @OneToOne(() => User, (user) => user.auth, { cascade: true })
  //   user!: User;

  //   @OneToMany(() => UserPokemon, (pokemon) => pokemon.auth)
  //   pokemons!: UserPokemon[];

  //   @OneToMany(() => UserBag, (bag) => bag.auth)
  //   bags!: UserBag[];

  //   @OneToMany(() => UserCostume, (costume) => costume.auth)
  //   costumes!: UserCostume[];

  //   @OneToMany(() => UserPokedex, (dex) => dex.auth)
  //   pokedex!: UserPokedex[];

  //   @OneToMany(() => AuditLog, (log) => log.auth)
  //   auditLogs!: AuditLog[];
}
