import { Repository } from "typeorm";
import { Bag } from "../entities/Bag";
import { AppDataSource } from "../db/data-source";

enum ItemType {
  POKEBALL = "pokeball",
  KEY = "key",
  BERRY = "berry",
  ETC = "etc",
}

export interface Item {
  item: string;
  stock: number;
}

export class BagService {
  static data: { item: string; type: ItemType }[] = [];

  private static get repo(): Repository<Bag> {
    return AppDataSource.getRepository(Bag);
  }

  public static getType(item: string): ItemType | null {
    const found = BagService.data.find((i) => i.item === item);
    return found ? (found.type as ItemType) : null;
  }

  public static async addItem(user: number, item: Item): Promise<void> {
    const itemType = this.getType(item.item);

    if (!itemType) {
      throw new Error(`Invalid item: ${item.item}`);
    }

    const exist = await this.repo.findOne({
      where: { account_id: user, item: item.item },
    });

    if (exist) {
      exist.stock += item.stock;
      await this.repo.save(exist);
    } else {
      const newItem = this.repo.create({
        account_id: user,
        item: item.item,
        category: itemType,
        stock: item.stock,
      });
      await this.repo.save(newItem);
    }
  }
}
