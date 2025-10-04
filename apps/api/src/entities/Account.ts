import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToOne, OneToMany } from 'typeorm';
import { AccountLocal } from './AccountLocal';
import { AccountSocial } from './AccountSocial';

@Entity({ schema: 'db', name: 'account' })
export class Account {
  @PrimaryGeneratedColumn()
  id!: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @Column({ type: 'boolean', default: false, name: 'is_delete' })
  isDelete!: boolean;

  @Column({ type: 'timestamptz', name: 'is_delete_at', default: null, nullable: true })
  isDeleteAt!: Date;

  @OneToOne(() => AccountLocal, (local) => local.account)
  local!: AccountLocal;

  @OneToMany(() => AccountSocial, (social) => social.account)
  socials!: AccountSocial;
}
