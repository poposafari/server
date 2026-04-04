import crypto from 'crypto';
import { sql, eq, and, inArray, isNotNull } from 'drizzle-orm';
import { db } from '@poposerver/lib/db';
import { userItem, userPokemon, userPokedex } from '@poposerver/lib/schema';
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
  PokemonTier,
  AppErrorCode,
  UserStartLocation,
} from '@poposerver/lib/types';
import { AppError } from '@poposerver/lib/utils/error';

type CatchResult = 'caught' | 'fail' | 'flee';

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
        const ability = pokemonData?.ability.length ? pickOne(pokemonData.ability) : '';
        const wildLevel = Math.min(100, Math.max(1, randomInt(userLevel - 10, userLevel + 10)));
        return {
          uid: crypto.randomUUID(),
          pokedexId,
          level: wildLevel,
          gender,
          isShiny: rollSafariShiny(),
          nature,
          ability,
          caught: 0,
          bait: false,
          rock: false,
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

  async pickItem(authId: string, uid: string): Promise<{ itemId: string; newQuantity: number }> {
    const userState = await getUserState(authId);
    if (!userState || !userState.mapId.startsWith('s')) {
      throw new AppError('Not in safari zone', 400, AppErrorCode.NOT_IN_SAFARI);
    }

    const safariData = await getSafariData(authId);
    if (!safariData) {
      throw new AppError('Not in safari zone', 400, AppErrorCode.NOT_IN_SAFARI);
    }

    const mapData = safariData[userState.mapId];
    if (!mapData) {
      throw new AppError('Safari map data not found', 404, AppErrorCode.NOT_FOUND);
    }

    const itemIndex = mapData.items.findIndex((item) => item.uid === uid);
    if (itemIndex === -1) {
      throw new AppError('Item not found in current map', 404, AppErrorCode.SAFARI_ITEM_NOT_FOUND);
    }

    const targetItem = mapData.items[itemIndex];

    if (targetItem.picked) {
      throw new AppError('Item already picked', 409, AppErrorCode.SAFARI_ITEM_ALREADY_PICKED);
    }

    // Redis: picked = true
    targetItem.picked = true;
    await setSafariData(authId, safariData);

    // DB: user_item upsert
    const accountId = Number(authId);
    const [result] = await db
      .insert(userItem)
      .values({
        accountId,
        itemId: targetItem.itemId,
        quantity: 1,
      })
      .onConflictDoUpdate({
        target: [userItem.accountId, userItem.itemId],
        set: {
          quantity: sql`${userItem.quantity} + 1`,
        },
      })
      .returning({ quantity: userItem.quantity });

    return {
      itemId: targetItem.itemId,
      newQuantity: result.quantity,
    };
  }

  async catchWild(
    authId: string,
    uid: string,
    bait: boolean,
    rock: boolean,
  ): Promise<{
    result: CatchResult;
    pokemon?: typeof userPokemon.$inferSelect;
    reward?: { candyId: string; candyQuantity: number };
  }> {
    const accountId = Number(authId);

    // 1. 사파리 존 검증
    const userState = await getUserState(authId);
    if (!userState || !userState.mapId.startsWith('s')) {
      throw new AppError('Not in safari zone', 400, AppErrorCode.NOT_IN_SAFARI);
    }

    const safariData = await getSafariData(authId);
    if (!safariData) {
      throw new AppError('Not in safari zone', 400, AppErrorCode.NOT_IN_SAFARI);
    }

    // 2. 사파리볼 보유 확인
    const [safariBall] = await db
      .select({ quantity: userItem.quantity })
      .from(userItem)
      .where(and(eq(userItem.accountId, accountId), eq(userItem.itemId, 'safari-ball')));

    if (!safariBall || safariBall.quantity <= 0) {
      throw new AppError('No safari balls', 400, AppErrorCode.SAFARI_BALL_NOT_FOUND);
    }

    // 3. 현재 맵에서 해당 야생 포켓몬 찾기
    const mapData = safariData[userState.mapId];
    if (!mapData) {
      throw new AppError('Safari map data not found', 404, AppErrorCode.NOT_FOUND);
    }

    const wildIndex = mapData.wilds.findIndex((w) => w.uid === uid);
    if (wildIndex === -1) {
      throw new AppError('Wild pokemon not found', 404, AppErrorCode.SAFARI_WILD_NOT_FOUND);
    }

    const wild = mapData.wilds[wildIndex];
    if (wild.caught === 1) {
      throw new AppError('Already caught', 409, AppErrorCode.SAFARI_WILD_ALREADY_CAUGHT);
    }
    if (wild.caught === 2) {
      throw new AppError('Already fled', 409, AppErrorCode.SAFARI_WILD_ALREADY_FLED);
    }

    // 4. 마스터 데이터에서 포켓몬 정보 조회
    const pokemonData = MasterData.getPokemon(wild.pokedexId);
    if (!pokemonData) {
      throw new AppError('Pokemon data not found', 500, AppErrorCode.INTERNAL_SERVER_ERROR);
    }

    // 5. 파티 포켓몬 보너스 계산
    const partyRaw: { id: number }[] = JSON.parse(userState.party || '[]');
    const partyIds = partyRaw.map((p) => p.id);
    let partyBonus = 0;

    if (partyIds.length > 0) {
      const partyPokemons = await db
        .select({
          pokedexId: userPokemon.pokedexId,
          level: userPokemon.level,
          isShiny: userPokemon.isShiny,
        })
        .from(userPokemon)
        .where(inArray(userPokemon.id, partyIds));

      const bonusData = partyPokemons.map((p) => {
        const masterPokemon = MasterData.getPokemon(String(p.pokedexId));
        return {
          level: p.level,
          isShiny: p.isShiny,
          tier: (masterPokemon?.tier ?? 'common') as PokemonTier,
        };
      });

      partyBonus = this.calculatePartyBonus(bonusData);
    }

    // 6. bait/rock 업데이트 (둘 다 true면 bait 우선)
    if (bait && rock) {
      rock = false;
    }
    wild.bait = bait;
    wild.rock = rock;

    // 7. 확률 계산 및 판정
    const result = this.calculateCatchResult(
      pokemonData.rateCapture,
      pokemonData.rateFlee,
      bait,
      rock,
      partyBonus,
    );

    // 8. 결과에 따른 Redis 업데이트
    if (result === 'fail') {
      wild.caught = 0;
      wild.bait = false;
      wild.rock = false;
    } else if (result === 'caught') {
      wild.caught = 1;
    } else {
      wild.caught = 2;
    }
    await setSafariData(authId, safariData);

    // 9. DB 트랜잭션
    if (result === 'caught') {
      const candyId = `${pokemonData.type1}-candy`;
      const candyRanges: Record<string, [number, number]> = {
        common: [1, 3],
        rare: [3, 5],
        epic: [10, 20],
        legendary: [50, 100],
      };
      const [candyMin, candyMax] = candyRanges[pokemonData.tier] ?? [1, 3];
      const candyQuantity = randomInt(candyMin, candyMax);

      let insertedPokemon: typeof userPokemon.$inferSelect;

      await db.transaction(async (tx) => {
        // 사파리볼 차감
        if (safariBall.quantity === 1) {
          await tx
            .delete(userItem)
            .where(and(eq(userItem.accountId, accountId), eq(userItem.itemId, 'safari-ball')));
        } else {
          await tx
            .update(userItem)
            .set({ quantity: sql`${userItem.quantity} - 1` })
            .where(and(eq(userItem.accountId, accountId), eq(userItem.itemId, 'safari-ball')));
        }

        // 빈 박스/그리드 자리 찾기
        const existingBoxPokemon = await tx
          .select({ boxNumber: userPokemon.boxNumber, gridNumber: userPokemon.gridNumber })
          .from(userPokemon)
          .where(and(eq(userPokemon.accountId, accountId), isNotNull(userPokemon.boxNumber)));

        const occupied = new Set(existingBoxPokemon.map((p) => `${p.boxNumber}:${p.gridNumber}`));
        let targetBox = 1;
        let targetGrid = 1;
        const MAX_BOX = 30;
        const MAX_GRID = 30;

        outer: for (let b = 1; b <= MAX_BOX; b++) {
          for (let g = 1; g <= MAX_GRID; g++) {
            if (!occupied.has(`${b}:${g}`)) {
              targetBox = b;
              targetGrid = g;
              break outer;
            }
          }
        }

        // user_pokemon 삽입
        const [inserted] = await tx
          .insert(userPokemon)
          .values({
            accountId,
            pokedexId: wild.pokedexId,
            level: wild.level,
            gender: wild.gender,
            isShiny: wild.isShiny,
            nickname: null,
            abilityId: wild.ability,
            natureId: wild.nature,
            skills: [],
            heldItemId: null,
            boxNumber: targetBox,
            gridNumber: targetGrid,
            partySlot: null,
            ballId: 1,
            caughtLocation: userState.mapId,
          })
          .returning();

        insertedPokemon = inserted;

        // user_pokedex upsert
        await tx
          .insert(userPokedex)
          .values({ accountId, pokedexId: wild.pokedexId, caughtCount: 1 })
          .onConflictDoUpdate({
            target: [userPokedex.accountId, userPokedex.pokedexId],
            set: { caughtCount: sql`${userPokedex.caughtCount} + 1` },
          });

        // 캔디 보상 upsert
        await tx
          .insert(userItem)
          .values({ accountId, itemId: candyId, quantity: candyQuantity })
          .onConflictDoUpdate({
            target: [userItem.accountId, userItem.itemId],
            set: { quantity: sql`${userItem.quantity} + ${candyQuantity}` },
          });
      });

      return {
        result,
        pokemon: insertedPokemon!,
        reward: { candyId, candyQuantity },
      };
    } else {
      // fail 또는 flee: 사파리볼만 차감
      if (safariBall.quantity === 1) {
        await db
          .delete(userItem)
          .where(and(eq(userItem.accountId, accountId), eq(userItem.itemId, 'safari-ball')));
      } else {
        await db
          .update(userItem)
          .set({ quantity: sql`${userItem.quantity} - 1` })
          .where(and(eq(userItem.accountId, accountId), eq(userItem.itemId, 'safari-ball')));
      }

      return { result };
    }
  }

  private calculateCatchResult(
    rateCapture: number,
    rateFlee: number,
    bait: boolean,
    rock: boolean,
    partyBonus: number,
  ): CatchResult {
    let captureMul = 1.0;
    let fleeMul = 1.0;

    if (bait) {
      captureMul = 0.5;
      fleeMul = 0.5;
    } else if (rock) {
      captureMul = 1.5;
      fleeMul = 2.0;
    }

    const finalCapture = Math.min(rateCapture * captureMul + partyBonus, 0.9);
    const finalFlee = Math.min(rateFlee * fleeMul, 0.9);

    if (Math.random() < finalCapture) return 'caught';
    if (Math.random() < finalFlee) return 'flee';
    return 'fail';
  }

  private calculatePartyBonus(
    partyPokemons: { level: number; isShiny: boolean; tier: PokemonTier }[],
  ): number {
    if (partyPokemons.length === 0) return 0;

    const tierBonus: Record<string, number> = {
      common: 0,
      rare: 0,
      epic: 0.03,
      legendary: 0.05,
      mythical: 0.05,
    };

    let maxBonus = 0;
    for (const p of partyPokemons) {
      const lvlBonus = Math.floor(p.level / 25) * 0.02;
      const shinyBonus = p.isShiny ? 0.03 : 0;
      const tBonus = tierBonus[p.tier] ?? 0;
      maxBonus = Math.max(maxBonus, lvlBonus + shinyBonus + tBonus);
    }

    return maxBonus;
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
