import { Ingame } from "../entities/Ingame";
import { AppDataSource } from "../db/data-source";
import { Repository } from "typeorm";
import { ConflictHttpError } from "../share/http-error";
import { verifyAccessToken } from "../share/jwt";
import { IngameAvatar, IngameGender } from "../entities/Ingame";

interface RegisterReq {
  gender: "boy" | "girl";
  avatar: "1" | "2" | "3" | "4";
  nickname: string;
}

export class IngameService {
  private static get repo(): Repository<Ingame> {
    return AppDataSource.getRepository(Ingame);
  }

  static async register(data: RegisterReq, token: string) {
    const payload = verifyAccessToken(token) as { id: number };
    const accountId = payload.id;

    const exist = await this.repo.findOneBy({
      nickname: data.nickname,
    });

    if (exist) throw new ConflictHttpError("already nickname");

    const ingameAccount = this.repo.create({
      account_id: accountId,
      x: 10,
      y: 10,
      location: "000",
      money: 5000,
      nickname: data.nickname,
      gender: getGenderEnum(data.gender),
      avatar: getAvatarEnum(data.avatar),
    });

    await this.repo.save(ingameAccount);
    return ingameAccount;
  }

  static async getUserData(user: number) {
    if (!user) throw Error("empty user.");

    const exist = await this.repo.findOneBy({
      account_id: user,
    });

    if (!exist) return null;

    return exist;
  }
}

const getAvatarEnum = (value: string): IngameAvatar => {
  const found = Object.values(IngameAvatar).find((v) => v === value);
  if (!found) throw new Error("Invalid avatar value");
  return found as IngameAvatar;
};

const getGenderEnum = (value: string): IngameGender => {
  const found = Object.values(IngameGender).find((v) => v === value);
  if (!found) throw new Error("Invalid gender value");
  return found as IngameGender;
};
