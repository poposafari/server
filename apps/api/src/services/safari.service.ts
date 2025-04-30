import { Repository } from "typeorm";
import { AppDataSource } from "../data-source";
import { ItemType, OverworldType } from "../enums";
import { UseTicketReq } from "../interfaces";
import { Bag } from "../entities/Bag";
import { BagService } from "./bag.service";

export class SafariService {
  static data: {
    comment: string;
    type: OverworldType;
    key: string;
    cost: number;
    x: number;
    y: number;
  }[] = [];

  private static get bagRepo(): Repository<Bag> {
    return AppDataSource.getRepository(Bag);
  }

  public static getOverworldData(key: string) {
    const found = SafariService.data.find((i) => i.key === key);
    return found;
  }

  public static async useTicket(
    user: number,
    data: UseTicketReq
  ): Promise<any> {
    const overworld = this.getOverworldData(data.overworld);

    if (!overworld) throw Error("Not found overworld data");

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let result: any;

    try {
      const bag = await queryRunner.manager.findOne(Bag, {
        where: { account_id: user, item: "030" },
      });

      if (!bag) {
        return "not-enough-ticket";
      }

      const newStock = bag.stock - overworld.cost;
      if (newStock < 0) {
        result = "not-enough-ticket";
      } else {
        bag.stock = newStock;
        await BagService.useItem(user, { item: "030", stock: overworld.cost });

        result = {
          item: "030",
          category: ItemType.ETC,
          stock: bag.stock,
        };

        await queryRunner.commitTransaction();
      }
    } catch (err: any) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    return result;
  }
}
