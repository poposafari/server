import { RedisStore, RedisKeys, WildPokemon, MapWildState, MasterData } from '@poposerver/shared';
import { MapTerrain } from '../utils/map-terrain';

const MOVE_DURATION_MS = 1000;
const MOVE_CHANCE = 0.2; // 20% 확률로 이동시킬거임.
const TTL_POKEMON = 1800;

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

class MovementService {
  public async processMovements(): Promise<void> {
    const maps = MasterData.getAllMaps();

    await Promise.all(
      maps.map(async (mapData) => {
        const mapId = mapData.id;
        const mapWildsKey = RedisKeys.mapWilds(mapId);
        const wildIds = await RedisStore.getClient().smembers(mapWildsKey);

        if (wildIds.length === 0) return;

        const dataKeys = wildIds.map((id) => RedisKeys.wildData(id));
        const rawDataList = await RedisStore.getClient().mget(dataKeys);

        const pokemons: WildPokemon[] = [];
        const occupiedSet = new Set<string>();

        rawDataList.forEach((raw) => {
          if (!raw) return;
          try {
            const p = JSON.parse(raw) as WildPokemon;
            pokemons.push(p);
            occupiedSet.add(`${p.x},${p.y}`);

            if (p.state === MapWildState.MOVING && p.destX !== undefined && p.destY !== undefined) {
              occupiedSet.add(`${p.destX},${p.destY}`);
            }
          } catch (e) {}
        });

        const pipeline = RedisStore.getClient().pipeline();
        let isUpdated = false;

        pokemons.forEach((pokemon) => {
          const now = Date.now();

          if (pokemon.state === MapWildState.MOVING) {
            if (pokemon.arriveAt && now >= pokemon.arriveAt) {
              this.handleArrival(pokemon, pipeline);
              isUpdated = true;
            }
          } else if (pokemon.state === MapWildState.IDLE) {
            if (Math.random() < MOVE_CHANCE) {
              const moved = this.tryMovePokemon(pokemon, mapId, occupiedSet, pipeline);
              if (moved) isUpdated = true;
            }
          }
        });

        if (isUpdated) {
          await pipeline.exec();
        }
      }),
    );
  }

  private handleArrival(pokemon: WildPokemon, pipeline: any): void {
    pokemon.x = pokemon.destX!;
    pokemon.y = pokemon.destY!;
    pokemon.state = MapWildState.IDLE; // 다시 IDLE로 변경시켜서 초기화.

    delete pokemon.destX;
    delete pokemon.destY;
    delete pokemon.arriveAt;

    pipeline.set(RedisKeys.wildData(pokemon.id), JSON.stringify(pokemon), 'EX', TTL_POKEMON);
  }

  private tryMovePokemon(
    pokemon: WildPokemon,
    mapId: string,
    occupiedSet: Set<string>,
    pipeline: any,
  ): boolean {
    const mapBounds = MapTerrain.getMapBounds(mapId);

    if (!mapBounds || mapBounds.width === 0 || mapBounds.height === 0) {
      return false;
    }

    const candidates: { x: number; y: number; dir: Direction }[] = [
      { x: pokemon.x, y: pokemon.y - 1, dir: 'UP' },
      { x: pokemon.x, y: pokemon.y + 1, dir: 'DOWN' },
      { x: pokemon.x - 1, y: pokemon.y, dir: 'LEFT' },
      { x: pokemon.x + 1, y: pokemon.y, dir: 'RIGHT' },
    ];

    const validDestinations = candidates.filter((pos) => {
      if (pos.x < 0 || pos.x >= mapBounds.width || pos.y < 0 || pos.y >= mapBounds.height) {
        return false;
      }

      if (occupiedSet.has(`${pos.x},${pos.y}`)) {
        return false;
      }

      const isBlocked = MapTerrain.isBlocked(mapId, pos.x, pos.y);
      if (isBlocked) {
        return false;
      }

      return true;
    });

    if (validDestinations.length === 0) {
      return false;
    }

    const dest = validDestinations[Math.floor(Math.random() * validDestinations.length)];

    pokemon.state = MapWildState.MOVING;
    pokemon.destX = dest.x;
    pokemon.destY = dest.y;
    pokemon.arriveAt = Date.now() + MOVE_DURATION_MS;

    occupiedSet.add(`${dest.x},${dest.y}`);

    pipeline.set(RedisKeys.wildData(pokemon.id), JSON.stringify(pokemon), 'EX', TTL_POKEMON);

    const packet = {
      type: 'MOVE_POKEMON',
      mapId,
      id: pokemon.id,
      direction: dest.dir,
      toX: dest.x,
      toY: dest.y,
      duration: MOVE_DURATION_MS,
    };

    pipeline.publish(RedisKeys.spawnChannel, JSON.stringify(packet));
    return true;
  }
}

export const MovementManager = new MovementService();
