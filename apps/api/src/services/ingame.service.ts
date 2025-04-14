import { Repository } from "typeorm";
import axios from "axios";
import { Ingame } from "../entities/Ingame";
import { ItemSlot } from "../entities/ItemSlot";
import { PartySlot } from "../entities/PartySlot";
import { PokeboxBg } from "../entities/PokeboxBg";
import { AppDataSource } from "../data-source";
import { ConflictHttpError } from "../utils/http-error";
import { verifyAccessToken } from "../utils/jwt";
import { BagService } from "./bag.service";
import { IngameAvatar, IngameGender } from "../enums";
import { ItemSlotData, RegisterReq } from "../interfaces";

export class IngameService {
  private static get repo(): Repository<Ingame> {
    return AppDataSource.getRepository(Ingame);
  }

  private static get itemSlotRepo(): Repository<ItemSlot> {
    return AppDataSource.getRepository(ItemSlot);
  }

  private static get partySlotRepo(): Repository<PartySlot> {
    return AppDataSource.getRepository(PartySlot);
  }

  private static get pokeboxBgRepo(): Repository<PokeboxBg> {
    return AppDataSource.getRepository(PokeboxBg);
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

    const itemSlot = this.itemSlotRepo.create({
      account_id: accountId,
    });

    const partySlot = this.partySlotRepo.create({
      account_id: accountId,
    });

    const pokeboxBg = this.pokeboxBgRepo.create({
      account_id: accountId,
    });

    await this.repo.save(ingameAccount);
    await this.itemSlotRepo.save(itemSlot);
    await this.partySlotRepo.save(partySlot);
    await this.pokeboxBgRepo.save(pokeboxBg);

    return ingameAccount;
  }

  static async getUserData(user: number) {
    if (!user) {
      throw Error("empty user.");
    }

    const data = await this.repo
      .createQueryBuilder("ingame")
      .leftJoinAndSelect("ingame.itemSlot", "itemSlot")
      .leftJoinAndSelect("ingame.partySlot", "partySlot")
      .leftJoinAndSelect("ingame.pokeboxBg", "pokeboxBg")
      .where("ingame.account_id = :user", { user })
      .getOne();

    if (!data) return null;

    return data;
  }

  static async updateItemSlot(user: number, itemSlot: ItemSlotData) {
    if (!user) {
      throw Error("empty user.");
    }

    const exist = await this.itemSlotRepo.findOneBy({
      account_id: user,
    });

    if (!exist) throw new Error("not found item slot data");

    await this.itemSlotRepo.update(exist.account_id, {
      slot1: itemSlot.slot1,
      slot2: itemSlot.slot2,
      slot3: itemSlot.slot3,
      slot4: itemSlot.slot4,
      slot5: itemSlot.slot5,
      slot6: itemSlot.slot6,
      slot7: itemSlot.slot7,
      slot8: itemSlot.slot8,
      slot9: itemSlot.slot9,
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
