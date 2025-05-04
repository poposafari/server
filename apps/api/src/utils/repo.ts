import { Repository } from "typeorm";
import { Bag } from "../entities/Bag";
import { AppDataSource } from "../data-source";
import { Ingame } from "../entities/Ingame";
import { Account } from "../entities/Account";
import { Pokebox } from "../entities/Pokebox";

export class Repo {
  public static get account(): Repository<Account> {
    return AppDataSource.getRepository(Account);
  }

  public static get ingame(): Repository<Ingame> {
    return AppDataSource.getRepository(Ingame);
  }

  public static get bag(): Repository<Bag> {
    return AppDataSource.getRepository(Bag);
  }

  public static get pokebox(): Repository<Pokebox> {
    return AppDataSource.getRepository(Pokebox);
  }
}
