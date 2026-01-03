import {
  PokemonEvolution,
  PokemonSpawnRate,
  PokemonSpawnTile,
  PokemonTier,
} from "libs/common/types/pokemon.type";
import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity("pokemon_data")
export class PokemonData {
  @PrimaryColumn({ type: "varchar", length: 50 })
  id: string;

  @Column({ type: "varchar", length: 50, default: "" })
  comment: string;

  @Column({ type: "varchar", array: true, default: [] })
  types: string[];

  @Column({ type: "varchar" })
  tier: PokemonTier;

  @Column({ name: "spawn_tile", type: "varchar", array: true, default: [] })
  spawnTile: PokemonSpawnTile[];

  @Column({
    type: "jsonb",
    default: { spawn: 0, capture: 0.0, flee: 0.0, male: 0.0, female: 0.0 },
  })
  rate: PokemonSpawnRate;

  @Column({
    type: "jsonb",
    default: { next: [], cost: [] },
  })
  evolution: PokemonEvolution;

  @Column({ type: "varchar", array: true, default: [] })
  skill: string[];

  @Column({ type: "varchar", array: true, default: [] })
  ability: string[];

  @Column({ type: "varchar", default: "" })
  generation: string;

  @Column({ name: "height_m", type: "varchar", default: "" })
  heightM: string;

  @Column({ name: "weight_kg", type: "varchar", default: "" })
  weightKg: string;
}
