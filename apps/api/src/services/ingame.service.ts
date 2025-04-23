import { Repository } from "typeorm";
import axios from "axios";
import { Ingame } from "../entities/Ingame";
import { AppDataSource } from "../data-source";
import { ConflictHttpError } from "../utils/http-error";
import { verifyAccessToken } from "../utils/jwt";
import { BagService } from "./bag.service";
import { Backgrounds, IngameAvatar, IngameGender } from "../enums";
import { BoxBgReq, RegisterReq, SlotReq } from "../interfaces";

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
      boxes: setDefaultBoxes(),
      party: [],
      itemslot: [null, null, null, null, null, null, null, null, null],
    });

    await this.repo.save(ingameAccount);

    return true;
  }

  static async getUserData(user: number) {
    if (!user) {
      throw Error("empty user.");
    }

    const data = await this.repo.findOneBy({
      account_id: user,
    });

    if (!data) return null;

    return {
      nickname: data.nickname,
      x: data.x,
      y: data.y,
      location: data.location,
      money: data.money,
      gender: data.gender,
      avatar: data.avatar,
      boxes: data.boxes,
      party: data.party,
      itemslot: data.itemslot,
    };
  }

  static async updateItemSlot(user: number, itemSlot: SlotReq) {
    if (!user) {
      throw Error("empty user.");
    }
    const exist = await this.repo.findOneBy({
      account_id: user,
    });
    if (!exist) throw new Error("not found item slot data");

    await this.repo.update(exist.account_id, {
      itemslot: itemSlot.data,
    });
  }

  static async updateParty(user: number, party: SlotReq) {
    if (!user) {
      throw Error("empty user.");
    }
    const exist = await this.repo.findOneBy({
      account_id: user,
    });
    if (!exist) throw new Error("not found item slot data");

    await this.repo.update(exist.account_id, {
      party: party.data,
    });
  }

  static async getAvailableTicket(user: number) {
    if (!user) {
      throw Error("empty user.");
    }

    const exist = await this.repo.findOneBy({
      account_id: user,
    });

    if (!exist) throw new Error("not found item slot data");

    return exist.available_ticket;
  }

  static async receiveAvailableTicket(user: number) {
    if (!user) {
      throw Error("empty user.");
    }

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const exist = await this.repo.findOneBy({
        account_id: user,
      });

      if (!exist) throw new Error("not found item slot data");

      const ticket = exist.available_ticket;

      await queryRunner.manager.update(
        Ingame,
        { account_id: user },
        { available_ticket: 0 }
      );

      await BagService.addItem(user, { item: "030", stock: ticket });

      await queryRunner.commitTransaction();
    } catch (err: any) {
      await queryRunner.rollbackTransaction();
      throw Error;
    } finally {
      await queryRunner.release();
    }
  }

  static async updatePokeboxBg(user: number, backgrounds: BoxBgReq) {
    if (!user) {
      throw Error("empty user.");
    }
    const exist = await this.repo.findOneBy({
      account_id: user,
    });
    if (!exist) throw new Error("not found pokeboxBg data");
    await this.repo.update(exist.account_id, {
      boxes: backgrounds.data,
    });
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

const MAX_BOX_SIZE = 33;

const setDefaultBoxes = (): Backgrounds[] => {
  let ret: Backgrounds[] = [];

  for (let i = 0; i < MAX_BOX_SIZE; i++) {
    ret.push(Backgrounds.ZERO);
  }

  return ret;
};
