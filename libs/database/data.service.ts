import { DataSource } from "typeorm";
import { PokemonData } from "./entities/PokemonData";
import { ItemData } from "./entities/ItemData";
import { MapData } from "./entities/MapData";
import { AppDataSource } from "./data-source";

class DataService {
  private pokemonCache: Map<string, PokemonData> = new Map();
  private itemCache: Map<string, ItemData> = new Map();
  private mapCache: Map<string, MapData> = new Map();

  constructor(private dataSource: DataSource) {}

  async initialize() {
    //TODO: 병렬로 빠르게 로딩(Promise.all)로 나중에 변경해야 할 수도 있음
    // await Promise.all([
    //     this.loadPokemonData(),
    //     this.loadItemData(),
    //     this.loadMapData(),
    //   ]);

    await this.loadPokemonData();
    await this.loadItemData();
    await this.loadMapData();

    console.log(`[INFO] All data loaded into cache successfully`);
  }

  async loadPokemonData() {
    const repo = this.dataSource.getRepository(PokemonData);
    const pokemons = await repo.find();

    const newCache = new Map<string, PokemonData>();
    pokemons.forEach((p) => newCache.set(p.id, p));

    this.pokemonCache = newCache;
    console.log(`[INFO] Loaded ${pokemons.length} pokemon data into cache`);
  }

  async loadItemData() {
    const repo = this.dataSource.getRepository(ItemData);
    const items = await repo.find();

    const newCache = new Map<string, ItemData>();
    items.forEach((i) => newCache.set(i.id, i));

    this.itemCache = newCache;
    console.log(`[INFO] Loaded ${items.length} item data into cache`);
  }

  async loadMapData() {
    const repo = this.dataSource.getRepository(MapData);
    const maps = await repo.find();

    const newCache = new Map<string, MapData>();
    maps.forEach((m) => newCache.set(m.id, m));

    this.mapCache = newCache;
    console.log(`[INFO] Loaded ${maps.length} map data into cache`);
  }

  getPokemonData(id: string) {
    if (!this.pokemonCache.has(id)) {
      throw new Error(`Pokemon data not found for id: ${id}`);
    }

    return this.pokemonCache.get(id);
  }

  getItemData(id: string) {
    if (!this.itemCache.has(id)) {
      throw new Error(`Item data not found for id: ${id}`);
    }

    return this.itemCache.get(id);
  }

  getMapData(id: string) {
    if (!this.mapCache.has(id)) {
      throw new Error(`Map data not found for id: ${id}`);
    }

    return this.mapCache.get(id);
  }
}

export default new DataService(AppDataSource);
