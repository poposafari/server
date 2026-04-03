import crypto from 'crypto';
import { MasterData } from '@poposerver/lib/utils/master-data';
import {
  getGameTime,
  getUserState,
  updateUserStateMap,
  setSafariData,
  getSafariData,
  deleteSafariData,
  SafariData,
  SafariWild,
  SafariItem,
} from '@poposerver/lib/redis';
import {
  rollSafariShiny,
  rollGender,
  randomInt,
  pickRandom,
  pickOne,
} from '@poposerver/lib/utils/rng';
import {
  TimeOfDay,
  Weather,
  PokemonNatural,
  AppErrorCode,
  UserStartLocation,
} from '@poposerver/lib/types';
import { AppError } from '@poposerver/lib/utils/error';

export class SafariService {
  async enter(authId: string, mapId: string): Promise<SafariData> {
    // 1-a. 검증: 현재 사용자가 plaza(p로 시작)에 있는지 확인
    const userState = await getUserState(authId);
    if (!userState || !userState.mapId.startsWith('p')) {
      throw new AppError('Must be in plaza to enter safari', 400, AppErrorCode.NOT_IN_PLAZA);
    }

    // 1-b. 검증: mapId가 s로 시작하고, 존재하는 safari 맵인지
    if (!mapId.startsWith('s')) {
      throw new AppError('Invalid safari map ID', 400, AppErrorCode.DTO_INVALID);
    }

    const targetMap = MasterData.getMap(mapId);
    if (!targetMap || targetMap.type !== 'safari') {
      throw new AppError('Map not found', 404, AppErrorCode.NOT_FOUND);
    }

    // 2. 이미 사파리에 있는지 확인
    const existing = await getSafariData(authId);
    if (existing) {
      throw new AppError('Already in safari zone', 409, AppErrorCode.ALREADY_IN_SAFARI);
    }

    // 3. 유저 레벨 조회 (Redis user state)
    const userLevel = Number(userState.level) || 1;

    // 4. 현재 게임 시간 조회
    const timeOfDay = ((await getGameTime()) ?? TimeOfDay.DAY) as TimeOfDay;
    const weather: Weather = Weather.SUNNY; // TODO: 날씨 시스템 구현 후 교체

    // 5. 모든 사파리 존 맵에 대해 생성
    const allMaps = MasterData.getAllMaps().filter((m) => m.id.startsWith('s'));
    const safariData: SafariData = {};

    for (const map of allMaps) {
      // 야생 포켓몬 생성
      const wildPool = map.wild[timeOfDay]?.[weather] ?? [];
      const wildCount = wildPool.length > 0 ? randomInt(map.wild.min, map.wild.max) : 0;
      const selectedPokemons = pickRandom(wildPool, wildCount);

      const wilds: SafariWild[] = selectedPokemons.map((pokedexId) => {
        const pokemonData = MasterData.getPokemon(pokedexId);
        const gender = pokemonData ? rollGender(pokemonData.rateMale, pokemonData.rateFemale) : 0;
        const nature = pickOne(PokemonNatural);
        const ability =
          pokemonData?.ability.length ? pickOne(pokemonData.ability) : '';
        const wildLevel = Math.min(100, Math.max(1, randomInt(userLevel - 10, userLevel + 10)));
        return {
          uid: crypto.randomUUID(),
          pokedexId,
          level: wildLevel,
          gender,
          isShiny: rollSafariShiny(),
          nature,
          ability,
          caught: false,
        };
      });

      // 아이템 생성
      const itemPool = map.item.spawn ?? [];
      const itemCount = itemPool.length > 0 ? randomInt(map.item.min, map.item.max) : 0;
      const selectedItems = pickRandom(itemPool, itemCount);

      const items: SafariItem[] = selectedItems.map((itemId) => ({
        uid: crypto.randomUUID(),
        itemId,
        picked: false,
      }));

      safariData[map.id] = { wilds, items };
    }

    // 6. Redis에 사파리 데이터 저장
    await setSafariData(authId, safariData);

    // 7. 사용자 위치를 요청한 사파리 맵의 entry로 업데이트
    const entry = targetMap.entry ?? { x: UserStartLocation.x, y: UserStartLocation.y };
    await updateUserStateMap(authId, {
      mapId,
      x: String(entry.x),
      y: String(entry.y),
      lastMoveTime: String(Date.now()),
    });

    return safariData;
  }

  async exit(authId: string): Promise<void> {
    // 1. 현재 사파리 존에 있는지 확인
    const userState = await getUserState(authId);
    if (!userState || !userState.mapId.startsWith('s')) {
      throw new AppError('Not in safari zone', 400, AppErrorCode.NOT_IN_SAFARI);
    }

    // 2. 사파리 데이터 삭제
    await deleteSafariData(authId);

    // 3. p001로 위치 이동
    const p001 = MasterData.getMap('p001');
    const entry = p001?.entry ?? { x: UserStartLocation.x, y: UserStartLocation.y };
    await updateUserStateMap(authId, {
      mapId: 'p001',
      x: String(entry.x),
      y: String(entry.y),
      lastMoveTime: String(Date.now()),
    });
  }
}
