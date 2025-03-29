import bcrypt from "bcrypt";
import { Repository } from "typeorm";
import { Account } from "../entities/Account";
import { AppDataSource } from "../db/data-source";
import {
  ConflictHttpError,
  HttpError,
  NotFountHttpError,
} from "../share/http-error";

interface LoginData {
  username: string;
  password: string;
}

const saltOrRounds = 10;

export class AccountService {
  private static get repo(): Repository<Account> {
    return AppDataSource.getRepository(Account);
  }

  static async register(data: Partial<Account>) {
    if (!data.password) throw Error("password value is null or undefined!!");

    const exist = await this.repo.findOneBy({
      username: data.username,
    });

    if (exist) throw new ConflictHttpError("already registered");

    const hashedPassword = await bcrypt.hash(data.password, saltOrRounds);

    const account = this.repo.create({ ...data, password: hashedPassword });
    return await this.repo.save(account);
  }

  static async login(data: LoginData) {
    const exist = await this.repo.findOneBy({
      username: data.username,
    });

    if (!exist) {
      throw new NotFountHttpError("not found account");
    }

    if (!exist.password) throw Error("password value is null or undefined!!");

    const compare = await bcrypt.compare(data.password, exist.password);

    if (!compare) throw new NotFountHttpError("not found account");

    return exist;
  }
}
