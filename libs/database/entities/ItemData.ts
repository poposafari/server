import { ItemCategory, ItemSpawn, ItemTier } from "libs/common/types/item.type";
import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity("item_data")
export class ItemData {
  @PrimaryColumn({ type: "varchar", length: 20 })
  id: string;

  @Column({ type: "varchar", length: 50, default: "" })
  comment: string;

  @Column({ type: "varchar", length: 20, default: "" })
  category: ItemCategory;

  @Column({ name: "buy_price", type: "int", default: 0 })
  buyPrice: number;

  @Column({ name: "sell_price", type: "int", default: 0 })
  sellPrice: number;

  @Column({ type: "boolean" })
  purchasable: boolean;

  @Column({ type: "boolean" })
  sellable: boolean;

  @Column({ type: "varchar", default: "" })
  tier: ItemTier;

  @Column({
    type: "jsonb",
    default: { spawnable: false, rate: 0, max: 0 },
  })
  spawn: ItemSpawn;
}
