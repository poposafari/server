import bcrypt from "bcrypt";
import { Repository } from "typeorm";
import { Account } from "../entities/Account";
import { AppDataSource } from "../data-source";
import { ConflictHttpError, NotFountHttpError } from "../utils/http-error";
import { LoginData } from "../interfaces";

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

  static async deleteAccount(user: number) {
    if (!user) throw Error("empty user.");

    const exist = await this.repo.findOneBy({
      id: user,
    });

    if (!exist) throw new Error("not found user data");

    await this.repo.delete({ id: exist.id });
    return exist;
  }
}
