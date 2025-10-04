import { Repository } from 'typeorm';
import { Bag } from '../entities/Bag';
import { AppDataSource } from '../data-source';
import { Ingame } from '../entities/Ingame';
import { Account } from '../entities/Account';
import { AccountLocal } from '../entities/AccountLocal';
import { AccountSocial } from '../entities/AccountSocial';
import { LastGroundItem } from '../entities/LastGroundItem';
import { LastWild } from '../entities/LastWild';
import { PC } from '../entities/PC';
import { IngameOption } from '../entities/IngameOption';

export class Repo {
  public static get account(): Repository<Account> {
    return AppDataSource.getRepository(Account);
  }

  public static get accountLocal(): Repository<AccountLocal> {
    return AppDataSource.getRepository(AccountLocal);
  }

  public static get accountSocial(): Repository<AccountSocial> {
    return AppDataSource.getRepository(AccountSocial);
  }

  public static get bag(): Repository<Bag> {
    return AppDataSource.getRepository(Bag);
  }

  public static get ingame(): Repository<Ingame> {
    return AppDataSource.getRepository(Ingame);
  }

  public static get ingameOption(): Repository<IngameOption> {
    return AppDataSource.getRepository(IngameOption);
  }

  public static get lastGroundItem(): Repository<LastGroundItem> {
    return AppDataSource.getRepository(LastGroundItem);
  }

  public static get lastWild(): Repository<LastWild> {
    return AppDataSource.getRepository(LastWild);
  }

  public static get pc(): Repository<PC> {
    return AppDataSource.getRepository(PC);
  }
}
