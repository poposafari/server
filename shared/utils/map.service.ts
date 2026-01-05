import fs from 'fs';
import path from 'path';

// Tiled JSON 구조를 본따 만든 인터페이스임.
interface TiledMap {
  width: number;
  height: number;
  layers: {
    data: number[];
    width: number;
    height: number;
  }[];
  tilesets: {
    firstgid: number;
    tiles?: {
      id: number;
      properties?: { name: string; type: string; value: string | boolean }[];
    }[];
  }[];
}

interface SpawnPoint {
  x: number;
  y: number;
}

interface MapSpawnData {
  land: SpawnPoint[];
  water: SpawnPoint[];
}

export class MapService {
  private static instance: MapService;
  private spawnPoints: Map<string, MapSpawnData> = new Map();

  public static getInstance(): MapService {
    if (!MapService.instance) {
      MapService.instance = new MapService();
    }
    return MapService.instance;
  }

  public async load(mapDir: string): Promise<void> {
    console.log('[MapManager] Loading maps from:', mapDir);

    if (!fs.existsSync(mapDir)) {
      console.warn(`[MapManager] Directory not found: ${mapDir}`);
      return;
    }

    const files = fs.readdirSync(mapDir).filter((file) => file.endsWith('.json'));

    for (const file of files) {
      const mapId = path.basename(file, '.json');
      const content = fs.readFileSync(path.join(mapDir, file), 'utf-8');

      try {
        const tiledMap = JSON.parse(content) as TiledMap;
        const spawnData = this.parseTiledMap(tiledMap);
        this.spawnPoints.set(mapId, spawnData);
        console.log(
          `[MapManager] Loaded ${mapId}: Land(${spawnData.land.length}), Water(${spawnData.water.length})`,
        );
      } catch (e) {
        console.error(`[MapManager] Failed to parse ${file}`, e);
      }
    }
  }

  private parseTiledMap(map: TiledMap): MapSpawnData {
    const result: MapSpawnData = { land: [], water: [] };

    // 1. GID(Global Tile ID)별 속성 매핑 생성
    // GID -> "land" | "water"
    const gidToType = new Map<number, string>();

    map.tilesets.forEach((tileset) => {
      const firstGid = tileset.firstgid;
      if (tileset.tiles) {
        tileset.tiles.forEach((tile) => {
          const spawnProp = tile.properties?.find((p) => p.name === 'spawn');
          if (spawnProp && typeof spawnProp.value === 'string') {
            const currentGid = firstGid + tile.id;
            gidToType.set(currentGid, spawnProp.value); // "land" or "water"
          }
        });
      }
    });

    map.layers.forEach((layer) => {
      if (!layer.data) return;

      layer.data.forEach((gid, index) => {
        if (gid === 0) return;

        const type = gidToType.get(gid);
        if (type) {
          const x = index % layer.width;
          const y = Math.floor(index / layer.width);

          if (type === 'land') {
            result.land.push({ x, y });
          } else if (type === 'water') {
            result.water.push({ x, y });
          }
        }
      });
    });

    return result;
  }

  public getRandomSpot(mapId: string, type: 'land' | 'water'): SpawnPoint | null {
    const data = this.spawnPoints.get(mapId);
    if (!data) return null;

    const spots = data[type];
    if (!spots || spots.length === 0) return null;

    const randomIndex = Math.floor(Math.random() * spots.length);
    return spots[randomIndex];
  }
}

export const MapManager = new MapService();
