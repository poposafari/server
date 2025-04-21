import { Repository } from "typeorm";
import axios from "axios";
import { Ingame } from "../entities/Ingame";
import { AppDataSource } from "../data-source";
import { ConflictHttpError } from "../utils/http-error";
import { verifyAccessToken } from "../utils/jwt";
import { BagService } from "./bag.service";
import { Backgrounds, IngameAvatar, IngameGender } from "../enums";
import { ItemSlotData, PokeboxBgReq, RegisterReq } from "../interfaces";

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
      party: ["000", "000", "000", "000", "000", "000"],
      itemslot: ["000", "000", "000", "000", "000", "000", "000", "000", "000"],
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

  static async updateItemSlot(user: number, itemSlot: ItemSlotData) {
    // if (!user) {
    //   throw Error("empty user.");
    // }
    // const exist = await this.itemSlotRepo.findOneBy({
    //   account_id: user,
    // });
    // if (!exist) throw new Error("not found item slot data");
    // await this.itemSlotRepo.update(exist.account_id, {
    //   slot1: itemSlot.slot1,
    //   slot2: itemSlot.slot2,
    //   slot3: itemSlot.slot3,
    //   slot4: itemSlot.slot4,
    //   slot5: itemSlot.slot5,
    //   slot6: itemSlot.slot6,
    //   slot7: itemSlot.slot7,
    //   slot8: itemSlot.slot8,
    //   slot9: itemSlot.slot9,
    // });
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

  static async updatePokeboxBg(user: number, data: PokeboxBgReq) {
    //   if (!user) {
    //     throw Error("empty user.");
    //   }
    //   const exist = await this.pokeboxBgRepo.findOneBy({
    //     account_id: user,
    //   });
    //   if (!exist) throw new Error("not found pokeboxBg data");
    //   await this.pokeboxBgRepo.update(exist.account_id, {
    //     box0: data.box0,
    //     box1: data.box1,
    //     box2: data.box2,
    //     box3: data.box3,
    //     box4: data.box4,
    //     box5: data.box5,
    //     box6: data.box6,
    //     box7: data.box7,
    //     box8: data.box8,
    //     box9: data.box9,
    //     box10: data.box10,
    //     box11: data.box11,
    //     box12: data.box12,
    //     box13: data.box13,
    //     box14: data.box14,
    //     box15: data.box15,
    //     box16: data.box16,
    //     box17: data.box17,
    //     box18: data.box18,
    //   });
    // }
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
