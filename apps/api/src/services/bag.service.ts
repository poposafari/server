import { Repository } from "typeorm";
import { Bag } from "../entities/Bag";
import { AppDataSource } from "../data-source";
import { ItemType } from "../enums";
import { Item, ItemSel } from "../interfaces";

const MAX_STOCK = 999;

export class BagService {
  static data: { item: string; type: ItemType }[] = [];

  private static get repo(): Repository<Bag> {
    return AppDataSource.getRepository(Bag);
  }

  public static getType(item: string): ItemType | null {
    const found = BagService.data.find((i) => i.item === item);
    return found ? (found.type as ItemType) : null;
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
