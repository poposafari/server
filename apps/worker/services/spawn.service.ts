import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  MasterData,
  RedisStore,
  RedisKeys,
  WildPokemon,
  MapWildState,
  WildItem,
} from '@poposerver/shared';
import { TimeOfDay, Weather } from '@poposerver/shared/types/etc.type';
import { RandomPicker } from '../utils/random-picker';
import { TimeManager } from './time.service';
import { WeatherManager } from './weather.service';
import { GameTime } from '../utils/game-time';

const PROBABILITY_SHINY = 4096;
const TTL_POKEMON = 1800; // 30분
const TTL_ITEM = 3600; // 1시간

/**
 * [Helper Class] 맵 JSON을 읽어 지형별 스폰 가능 좌표를 관리합니다.
 * 매번 파일을 읽지 않고 메모리에 캐싱합니다.
 */
class MapTerrainManager {
  private static cache: Map<string, Record<string, { x: number; y: number }[]>> = new Map();

  public static getSpawnableSpots(mapId: string, terrain: string): { x: number; y: number }[] {
    if (!this.cache.has(mapId)) {
      this.loadMapData(mapId);
    }
    const mapData = this.cache.get(mapId);
    return mapData ? mapData[terrain] || [] : [];
  }

  private static loadMapData(mapId: string): void {
    try {
      const filePath = path.join(process.cwd(), 'shared/master', `${mapId}.json`);

      if (!fs.existsSync(filePath)) {
        console.warn(`[MapTerrain] Map file not found: ${filePath}`);
        this.cache.set(mapId, { land: [], water: [] });
        return;
      }

      const rawData = fs.readFileSync(filePath, 'utf-8');
      const json = JSON.parse(rawData);

      const tileProperties: Record<number, string> = {}; // gid -> 'land' | 'water'

      if (json.tilesets) {
        json.tilesets.forEach((tileset: any) => {
          const firstGid = tileset.firstgid;
          if (tileset.tiles) {
            tileset.tiles.forEach((tile: any) => {
              const globalId = firstGid + tile.id;

              if (tile.properties) {
                const spawnProp = tile.properties.find((p: any) => p.name === 'spawn');
                if (spawnProp) {
                  tileProperties[globalId] = spawnProp.value; // 'land' or 'water'
                }
              }
            });
          }
        });
      }

      const spots: Record<string, { x: number; y: number }[]> = { land: [], water: [] };
      const width = json.width;

      if (json.layers) {
        json.layers.forEach((layer: any) => {
          if (layer.type === 'tilelayer' && layer.data) {
            layer.data.forEach((gid: number, index: number) => {
              const terrainType = tileProperties[gid];
              if (terrainType && spots[terrainType]) {
                const x = index % width;
                const y = Math.floor(index / width);
                spots[terrainType].push({ x, y });
              }
            });
          }
        });
      }

      this.cache.set(mapId, spots);
      console.log(
        `[MapTerrain] Loaded spawn points for ${mapId} - Land: ${spots.land.length}, Water: ${spots.water.length}`,
      );
    } catch (error) {
      console.error(`[MapTerrain] Error loading map ${mapId}:`, error);
      this.cache.set(mapId, { land: [], water: [] });
    }
  }
}

class SpawnService {
  public async spawnPokemons(): Promise<void> {
    const maps = MasterData.getAllMaps();
    const timePhase = TimeManager.getCurrentTimePhase();

    await Promise.all(
      maps.map(async (mapData) => {
        const weather = await WeatherManager.getOrUpdateWeather(mapData.id);
        const mapWildsKey = RedisKeys.mapWilds(mapData.id);
        const currentCount = await RedisStore.getClient().scard(mapWildsKey);

        if (currentCount >= mapData.wildMax) return;

        const needed = mapData.wildMax - currentCount;
        const spawnKey = GameTime.getSpawnKey(weather as Weather, timePhase as TimeOfDay);
        const candidateIds = (mapData as any)[spawnKey] as string[];

        if (!candidateIds || candidateIds.length === 0) return;

        const occupiedSet = await this.getOccupiedCoordinates(mapData.id, 'pokemon');

        for (let i = 0; i < needed; i += 1) {
          await this.createWildPokemon(mapData.id, candidateIds, occupiedSet);
        }
      }),
    );
  }

  public async spawnItems(): Promise<void> {
    const maps = MasterData.getAllMaps();

    await Promise.all(
      maps.map(async (mapData) => {
        const itemKey = RedisKeys.mapItems(mapData.id);
        const currentCount = await RedisStore.getClient().scard(itemKey);

        if (currentCount >= mapData.itemMax) return;

        const needed = mapData.itemMax - currentCount;
        const candidateIds = mapData.itemSpawn;

        if (!candidateIds || candidateIds.length === 0) return;

        const occupiedSet = await this.getOccupiedCoordinates(mapData.id, 'item');

        for (let i = 0; i < needed; i += 1) {
          await this.createDroppedItem(mapData.id, candidateIds, occupiedSet);
        }
      }),
    );
  }

  // --- Helpers ---
  private async getOccupiedCoordinates(
    mapId: string,
    type: 'pokemon' | 'item',
  ): Promise<Set<string>> {
    const redis = RedisStore.getClient();
    const setKey = type === 'pokemon' ? RedisKeys.mapWilds(mapId) : RedisKeys.mapItems(mapId);

    const ids = await redis.smembers(setKey);
    if (ids.length === 0) return new Set();

    const dataKeys = ids.map((id) =>
      type === 'pokemon' ? RedisKeys.wildData(id) : RedisKeys.itemData(id),
    );
    const rawDataList = await redis.mget(dataKeys);

    const occupied = new Set<string>();
    rawDataList.forEach((raw) => {
      if (!raw) return;
      try {
        const data = JSON.parse(raw);
        if (data.x !== undefined && data.y !== undefined) {
          occupied.add(`${data.x},${data.y}`);
        }
      } catch (e) {}
    });

    return occupied;
  }

  private pickValidPosition(
    mapId: string,
    terrain: string,
    occupiedSet: Set<string>,
  ): { x: number; y: number } | null {
    const allSpots = MapTerrainManager.getSpawnableSpots(mapId, terrain);
    const availableSpots = allSpots.filter((spot) => !occupiedSet.has(`${spot.x},${spot.y}`));

    if (availableSpots.length === 0) return null;

    const randomIndex = Math.floor(Math.random() * availableSpots.length);
    const selected = availableSpots[randomIndex];

    occupiedSet.add(`${selected.x},${selected.y}`);
    return selected;
  }

  private async createWildPokemon(mapId: string, candidateIds: string[], occupiedSet: Set<string>) {
    const candidates = candidateIds
      .map((id) => MasterData.getPokemon(id))
      .filter((p) => p !== undefined);

    const selectedSpecies = RandomPicker.pick(candidates, (p) => p!.rateSpawn);
    if (!selectedSpecies) return;

    const availableTerrains =
      selectedSpecies.spawn && selectedSpecies.spawn.length > 0 ? selectedSpecies.spawn : ['land'];

    const targetTerrain = availableTerrains[Math.floor(Math.random() * availableTerrains.length)];

    const position = this.pickValidPosition(mapId, targetTerrain, occupiedSet);

    if (!position) {
      return;
    }

    let gender: 'male' | 'female' | 'none' = 'none';
    const randGender = Math.random();
    if (selectedSpecies.rateFemale > 0 && randGender <= selectedSpecies.rateFemale) {
      gender = 'female';
    } else if (
      selectedSpecies.rateMale > 0 &&
      randGender <= selectedSpecies.rateFemale + selectedSpecies.rateMale
    ) {
      gender = 'male';
    }
    const isShiny = RandomPicker.checkProbability(PROBABILITY_SHINY);

    const wildId = uuidv4();
    const wildData: WildPokemon = {
      id: wildId,
      pokedex: selectedSpecies.id,
      gender,
      isShiny,
      state: MapWildState.IDLE,
      mapId,
      x: position.x,
      y: position.y,
      spawnedAt: Date.now(),
      despawnAt: Date.now() + 1000 * 60 * 30, // 30분
    };

    const pipeline = RedisStore.getClient().pipeline();
    pipeline.set(RedisKeys.wildData(wildId), JSON.stringify(wildData), 'EX', TTL_POKEMON);
    pipeline.sadd(RedisKeys.mapWilds(mapId), wildId);
    pipeline.publish(
      RedisKeys.spawnChannel,
      JSON.stringify({ type: 'SPAWN_POKEMON', mapId, data: wildData }),
    );
    await pipeline.exec();
  }

  private async createDroppedItem(mapId: string, candidateIds: string[], occupiedSet: Set<string>) {
    const candidates = candidateIds
      .map((id) => MasterData.getItem(id))
      .filter((item) => item !== undefined);

    const selectedItem = RandomPicker.pick(candidates, (item) => item!.spawnRate);
    if (!selectedItem) return;

    const position = this.pickValidPosition(mapId, 'land', occupiedSet);

    if (!position) return;

    const dropId = uuidv4();
    const itemData: WildItem = {
      id: dropId,
      itemId: selectedItem.id,
      amount: 1,
      state: MapWildState.IDLE,
      mapId,
      x: position.x,
      y: position.y,
      spawnedAt: Date.now(),
    };

    const pipeline = RedisStore.getClient().pipeline();
    pipeline.set(RedisKeys.itemData(dropId), JSON.stringify(itemData), 'EX', TTL_ITEM);
    pipeline.sadd(RedisKeys.mapItems(mapId), dropId);
    pipeline.publish(
      RedisKeys.spawnChannel,
      JSON.stringify({ type: 'SPAWN_ITEM', mapId, data: itemData }),
    );
    await pipeline.exec();
  }
}

export const SpawnManager = new SpawnService();
