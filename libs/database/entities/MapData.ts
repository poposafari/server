import {
  MapGroundItemSpawn,
  MapType,
  MapWildSpawn,
} from "libs/common/types/map.type";
import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity("map_data")
export class MapData {
  @PrimaryColumn({ type: "char", length: 4 })
  id: string;

  @Column({ type: "varchar", length: 50, default: "" })
  comment: string;

  @Column({ type: "varchar", default: "" })
  type: MapType;

  @Column({
    type: "jsonb",
    default: {
      max: 0,
      sunny: { dawn: [], day: [], dusk: [], night: [] },
      rainy: { dawn: [], day: [], dusk: [], night: [] },
      stormy: { dawn: [], day: [], dusk: [], night: [] },
      snowy: { dawn: [], day: [], dusk: [], night: [] },
      windy: { dawn: [], day: [], dusk: [], night: [] },
    },
  })
  wild: MapWildSpawn;

  @Column({
    name: "ground_item",
    type: "jsonb",
    default: { max: 0, spawn: [] },
  })
  groundItem: MapGroundItemSpawn;
}
