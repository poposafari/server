import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { Account } from './entities/Account';
import { Ingame } from './entities/Ingame';
import { Bag } from './entities/Bag';
import { LastGroundItem } from './entities/LastGroundItem';
import { LastWild } from './entities/LastWild';
import { PC } from './entities/PC';
import { AccountSocial } from './entities/AccountSocial';
import { AccountLocal } from './entities/AccountLocal';
import { IngameOption } from './entities/IngameOption';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [Account, AccountLocal, AccountSocial, Ingame, IngameOption, Bag, PC, LastGroundItem, LastWild],
  synchronize: true,
  logging: true,
});
