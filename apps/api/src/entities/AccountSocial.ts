import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Account } from './Account';
import { SocialProviderType } from '../shared/enums';

@Entity({ schema: 'db', name: 'account_social' })
export class AccountSocial {
  @PrimaryColumn({ type: 'enum', enum: SocialProviderType })
  provider!: SocialProviderType;

  @PrimaryColumn({ type: 'varchar', length: 100 })
  provider_id!: string;

  @ManyToOne(() => Account, (account) => account.socials, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account!: Account;
}
