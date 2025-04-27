import { Repository } from "typeorm";
import { Bag } from "../entities/Bag";
import { AppDataSource } from "../data-source";
import { ItemType } from "../enums";
import { Item, ItemSel } from "../interfaces";
import { Ingame } from "../entities/Ingame";

const MAX_STOCK = 999;
const MAX_BUY = 99;

export class BagService {
  static data: {
    item: string;
    type: ItemType;
    price: number;
    purchasable: boolean;
  }[] = [];

  private static get repo(): Repository<Bag> {
    return AppDataSource.getRepository(Bag);
  }

  private static get ingameRepo(): Repository<Ingame> {
    return AppDataSource.getRepository(Ingame);
  }

  public static getType(item: string): ItemType | null {
    const found = BagService.data.find((i) => i.item === item);
    return found ? (found.type as ItemType) : null;
  }

  public static getItemInfo(item: string) {
    const found = BagService.data.find((i) => i.item === item);
    return found;
  }

  public static async addItem(user: number, item: Item): Promise<Item> {
    const itemType = this.getType(item.item);

    if (!itemType) {
      throw new Error(`Invalid item: ${item.item}`);
    }

    if (item.stock <= 0 || item.stock > MAX_STOCK) {
      throw new Error("Wrong stock.");
    }

    const exist = await this.repo.findOne({
      where: { account_id: user, item: item.item },
    });

    if (exist) {
      exist.stock += item.stock;

      if (exist.stock > MAX_STOCK) {
        throw new Error("stock is over MAX_STOCK");
      }

      await this.repo.save(exist);

      return exist;
    } else {
      const newItem = this.repo.create({
        account_id: user,
        item: item.item,
        category: itemType,
        stock: item.stock,
      });
      await this.repo.save(newItem);
      return newItem;
    }
  }

  public static async buyItem(user: number, item: Item): Promise<any> {
    const queryRunner = AppDataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const itemInfo = BagService.getItemInfo(item.item);
      if (!itemInfo) throw new Error("Not found item info");
      if (!itemInfo.purchasable) throw new Error("Item is not purchasable");
      if (item.stock <= 0 || item.stock > MAX_BUY)
        throw new Error("Wrong buy stock");

      const userData = await queryRunner.manager.findOne(Ingame, {
        where: { account_id: user },
      });
      if (!userData) throw new Error("Not found ingame data");

      const bag = await queryRunner.manager.findOne(Bag, {
        where: { account_id: user, item: item.item },
      });

      const cost = item.stock * itemInfo.price;
      if (cost > userData.money) return "not-enough-money";

      userData.money -= cost;

      let resultItem: Item;

      if (bag) {
        const newStock = bag.stock + item.stock;
        if (newStock > MAX_STOCK) return "exceed-max-stock";

        bag.stock = newStock;

        await queryRunner.manager.save(bag);
        resultItem = bag;
      } else {
        resultItem = await BagService.addItem(user, item);
      }
      await queryRunner.manager.save(userData);

      await queryRunner.commitTransaction();

      return {
        candy: userData.money,
        item: resultItem.item,
        category: itemInfo.type,
        stock: resultItem.stock,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  public static async useItem(user: number, item: Item): Promise<Item | null> {
    const exist = await this.repo.findOne({
      where: { account_id: user, item: item.item },
    });

    if (!exist) {
      throw new Error(`Item not found in bag: ${item.item}`);
    }

    if (exist.stock < item.stock) {
      throw new Error(`Not enough stock for item: ${item.item}`);
    }

    if (item.stock <= 0) {
      throw new Error("Wrong stock");
    }

    if (exist.stock - item.stock <= 0) {
      await this.repo.delete(exist);
      return null;
    }

    exist.stock -= item.stock;

    await this.repo.save(exist);
    return exist;
  }

  public static async getItems(user: number, item: ItemSel): Promise<Item[]> {
    const bag = await this.repo.find({
      where: { account_id: user, category: item.category },
    });

    return bag.map((item) => ({
      item: item.item,
      stock: item.stock,
    }));
  }

  public static async getAllItems(user: number): Promise<Item[]> {
    const bag = await this.repo.find({
      where: { account_id: user },
    });

    return bag.map((item) => ({
      item: item.item,
      category: item.category,
      stock: item.stock,
    }));
  }
}
