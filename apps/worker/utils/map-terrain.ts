import fs from 'fs';
import path from 'path';

interface MapCacheData {
  width: number;
  height: number;
  blocked: Set<string>;
  land: { x: number; y: number }[];
  water: { x: number; y: number }[];
}

export class MapTerrain {
  private static cache: Map<string, MapCacheData> = new Map();

  public static getMapBounds(mapId: string): { width: number; height: number } | undefined {
    if (!this.cache.has(mapId)) {
      this.loadMapData(mapId);
    }
    const data = this.cache.get(mapId);
    if (!data) return undefined;

    return { width: data.width, height: data.height };
  }

  public static isBlocked(mapId: string, x: number, y: number): boolean {
    if (!this.cache.has(mapId)) this.loadMapData(mapId);
    const mapData = this.cache.get(mapId);
    return mapData ? mapData.blocked.has(`${x},${y}`) : true;
  }

  private static loadMapData(mapId: string): void {
    try {
      const filePath = path.join(process.cwd(), 'shared/master', `${mapId}.json`);

      if (!fs.existsSync(filePath)) {
        console.warn(`[MapTerrain] Map file not found: ${filePath}`);
        this.cache.set(mapId, { width: 0, height: 0, blocked: new Set(), land: [], water: [] });
        return;
      }

      const rawData = fs.readFileSync(filePath, 'utf-8');
      const json = JSON.parse(rawData);

      const width = json.width || 20; // 안전장치
      const height = json.height || 20;

      const collisionGids = new Set<number>();
      const spawnProps: Record<number, string> = {};

      if (json.tilesets) {
        json.tilesets.forEach((tileset: any) => {
          const firstGid = tileset.firstgid;
          if (tileset.tiles) {
            tileset.tiles.forEach((tile: any) => {
              const globalId = firstGid + tile.id;
              if (tile.properties) {
                const collides = tile.properties.find(
                  (p: any) => p.name === 'collides' && p.value === true,
                );
                if (collides) collisionGids.add(globalId);

                const spawnProp = tile.properties.find((p: any) => p.name === 'spawn');
                if (spawnProp) spawnProps[globalId] = spawnProp.value;
              }
            });
          }
        });
      }

      const blockedSet = new Set<string>();
      const spawnSpots: Record<string, { x: number; y: number }[]> = { land: [], water: [] };

      if (json.layers) {
        json.layers.forEach((layer: any) => {
          if (layer.type === 'tilelayer' && layer.data) {
            layer.data.forEach((gid: number, index: number) => {
              if (gid === 0) return;

              const x = index % width;
              const y = Math.floor(index / width);

              if (collisionGids.has(gid)) blockedSet.add(`${x},${y}`);

              const spawnType = spawnProps[gid];
              if (spawnType && spawnSpots[spawnType]) {
                spawnSpots[spawnType].push({ x, y });
              }
            });
          }
        });
      }

      this.cache.set(mapId, {
        width,
        height,
        blocked: blockedSet,
        land: spawnSpots.land,
        water: spawnSpots.water,
      });
    } catch (error) {
      console.error(`[MapTerrain] Error loading map ${mapId}:`, error);
      this.cache.set(mapId, { width: 0, height: 0, blocked: new Set(), land: [], water: [] });
    }
  }
}
