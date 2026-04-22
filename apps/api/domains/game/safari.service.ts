import crypto from 'crypto';
import { sql, eq, and, inArray, isNotNull } from 'drizzle-orm';
import { db } from '@poposerver/lib/db';
import { userItem, userPokemon, userPokedex } from '@poposerver/lib/schema';
import { MasterData } from '@poposerver/lib/utils/master-data';
import {
  getGameTime,
  getUserState,
  updateUserStateMap,
  setSafariMapData,
  getSafariMapData,
  deleteAllSafariData,
  SafariMapData,
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
import { LEVEL_CURVE } from '@poposerver/lib/constants/level-curve';
import { applyUserExp } from '@poposerver/lib/utils/level';

type CatchResult = 'caught' | 'fail' | 'flee';
type FleeResult = 'flee' | 'stay';

export class SafariService {
  async enter(
    authId: string,
    mapId: string,
    needEntry: boolean,
  ): Promise<{ mapData: SafariMapData; entry?: { x: number; y: number } }> {
    // 1-a. 검증: 현재 사용자가 plaza 또는 safari에 있는지 확인
    const userState = await getUserState(authId);
    if (!userState) {
      throw new AppError('Must be in plaza to enter safari', 400, AppErrorCode.NOT_IN_PLAZA);
    }

    const currentPrefix = userState.mapId[0];
    if (currentPrefix !== 'p' && currentPrefix !== 's') {
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

    // 2. 해당 맵 데이터가 이미 있으면 데이터 유지, 위치만 이동
    let mapData = await getSafariMapData(authId, mapId);

    if (!mapData) {
      // 3. 유저 레벨 조회
      const userLevel = Number(userState.level) || 1;

      // 4. 현재 게임 시간 조회
      const gameTime = await getGameTime();
      const timeOfDay = (gameTime?.phase ?? TimeOfDay.DAY) as TimeOfDay;
      const weather: Weather = Weather.SUNNY; // TODO: 날씨 시스템 구현 후 교체

      // 5. 요청 맵에 대해서만 야생 포켓몬 생성
      const wildPool = targetMap.wild[timeOfDay]?.[weather] ?? [];
      const wildCount = wildPool.length > 0 ? randomInt(targetMap.wild.min, targetMap.wild.max) : 0;
      const selectedPokemons = pickRandom(wildPool, wildCount);

      const uniquePokedexIds = Array.from(new Set(selectedPokemons));
      const pokedexRows = uniquePokedexIds.length
        ? await db
            .select({
              pokedexId: userPokedex.pokedexId,
              caughtCount: userPokedex.caughtCount,
            })
            .from(userPokedex)
            .where(
              and(
                eq(userPokedex.accountId, Number(authId)),
                inArray(userPokedex.pokedexId, uniquePokedexIds),
              ),
            )
        : [];
      const caughtCountMap = new Map(pokedexRows.map((r) => [r.pokedexId, r.caughtCount]));

      const wilds: SafariWild[] = selectedPokemons.map((pokedexId) => {
        const pokemonData = MasterData.getPokemon(pokedexId);
        const gender = pokemonData ? rollGender(pokemonData.rateMale, pokemonData.rateFemale) : 0;
        const nature = pickOne(PokemonNatural);
        const ability = pokemonData?.ability.length ? pickOne(pokemonData.ability) : '';
        const { min: wildMin, max: wildMax } = LEVEL_CURVE.wildLevelRange(userLevel);
        const wildLevel = randomInt(wildMin, wildMax);
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
          caughtCount: caughtCountMap.get(pokedexId) ?? 0,
        };
      });

      // 아이템 생성
      const itemPool = targetMap.item.spawn ?? [];
      const itemCount = itemPool.length > 0 ? randomInt(targetMap.item.min, targetMap.item.max) : 0;
      const selectedItems = pickRandom(itemPool, itemCount);

      const items: SafariItem[] = selectedItems.map((itemId) => ({
        uid: crypto.randomUUID(),
        itemId,
        picked: false,
      }));

      mapData = { wilds, items };
      await setSafariMapData(authId, mapId, mapData);
    }

    // 6. 사용자 위치 업데이트
    if (needEntry) {
      const entry = targetMap.entry ?? { x: UserStartLocation.x, y: UserStartLocation.y };
      await updateUserStateMap(authId, {
        mapId,
        x: String(entry.x),
        y: String(entry.y),
        lastMoveTime: String(Date.now()),
      });
      return { mapData, entry };
    }

    // await updateUserStateMap(authId, {
    //   mapId,
    //   x: String(userState.x),
    //   y: String(userState.y),
    //   lastMoveTime: String(Date.now()),
    // });
    return { mapData };
  }

  async pickItem(authId: string, uid: string): Promise<{ itemId: string; newQuantity: number }> {
    const userState = await getUserState(authId);
    if (!userState || !userState.mapId.startsWith('s')) {
      throw new AppError('Not in safari zone', 400, AppErrorCode.NOT_IN_SAFARI);
    }

    const mapId = userState.mapId;
    const mapData = await getSafariMapData(authId, mapId);
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
    await setSafariMapData(authId, mapId, mapData);

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
  ): Promise<{
    result: CatchResult;
    pokemon?: typeof userPokemon.$inferSelect;
    reward?: { candyId: string; candyQuantity: number };
    expReward?: { gained: number; level: number; exp: number; leveledUp: boolean };
  }> {
    const accountId = Number(authId);

    // 1. 사파리 존 검증
    const userState = await getUserState(authId);
    if (!userState || !userState.mapId.startsWith('s')) {
      throw new AppError('Not in safari zone', 400, AppErrorCode.NOT_IN_SAFARI);
    }

    const mapId = userState.mapId;
    const mapData = await getSafariMapData(authId, mapId);
    if (!mapData) {
      throw new AppError('Safari map data not found', 404, AppErrorCode.NOT_FOUND);
    }

    // 2. 사파리볼 보유 확인
    const [safariBall] = await db
      .select({ quantity: userItem.quantity })
      .from(userItem)
      .where(and(eq(userItem.accountId, accountId), eq(userItem.itemId, 'safari-ball')));

    if (!safariBall || safariBall.quantity <= 0) {
      throw new AppError('No safari balls', 400, AppErrorCode.SAFARI_BALL_NOT_FOUND);
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

    // 5. 파티 포켓몬 보너스 계산 (DB 직통)
    const partyPokemons = await db
      .select({
        id: userPokemon.id,
        pokedexId: userPokemon.pokedexId,
        level: userPokemon.level,
        isShiny: userPokemon.isShiny,
      })
      .from(userPokemon)
      .where(and(eq(userPokemon.accountId, accountId), isNotNull(userPokemon.partySlot)));

    const partyIds = partyPokemons.map((p) => p.id);
    let partyBonus = 0;

    if (partyIds.length > 0) {
      await db
        .update(userPokemon)
        .set({
          friendship: sql`LEAST(${userPokemon.friendship} + 2, 255)`,
        })
        .where(and(eq(userPokemon.accountId, accountId), inArray(userPokemon.id, partyIds)));

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

    // 6. 확률 계산 및 판정 (Redis에 저장된 bait/rock 상태 사용)
    const result = this.calculateCatchResult(
      pokemonData.rateCapture,
      pokemonData.rateFlee,
      wild.bait,
      wild.rock,
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
    await setSafariMapData(authId, mapId, mapData);

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
      let expReward: { gained: number; level: number; exp: number; leveledUp: boolean };

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

        const expGain = LEVEL_CURVE.expGain(pokemonData.tier, wild.level);
        const applied = await applyUserExp(tx, accountId, expGain);
        expReward = {
          gained: applied.gained,
          level: applied.level,
          exp: applied.exp,
          leveledUp: applied.leveledUp,
        };
      });

      return {
        result,
        pokemon: insertedPokemon!,
        reward: { candyId, candyQuantity },
        expReward: expReward!,
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

  async baitWild(authId: string, uid: string): Promise<{ result: FleeResult }> {
    return this.applyBaitOrRock(authId, uid, 'bait');
  }

  async rockWild(authId: string, uid: string): Promise<{ result: FleeResult }> {
    return this.applyBaitOrRock(authId, uid, 'rock');
  }

  private async applyBaitOrRock(
    authId: string,
    uid: string,
    kind: 'bait' | 'rock',
  ): Promise<{ result: FleeResult }> {
    const userState = await getUserState(authId);
    if (!userState || !userState.mapId.startsWith('s')) {
      throw new AppError('Not in safari zone', 400, AppErrorCode.NOT_IN_SAFARI);
    }

    const mapId = userState.mapId;
    const mapData = await getSafariMapData(authId, mapId);
    if (!mapData) {
      throw new AppError('Safari map data not found', 404, AppErrorCode.NOT_FOUND);
    }

    const wild = mapData.wilds.find((w) => w.uid === uid);
    if (!wild) {
      throw new AppError('Wild pokemon not found', 404, AppErrorCode.SAFARI_WILD_NOT_FOUND);
    }
    if (wild.caught === 1) {
      throw new AppError('Already caught', 409, AppErrorCode.SAFARI_WILD_ALREADY_CAUGHT);
    }
    if (wild.caught === 2) {
      throw new AppError('Already fled', 409, AppErrorCode.SAFARI_WILD_ALREADY_FLED);
    }

    // 플래그 업데이트 (배타적: bait/rock 중 하나만 true)
    if (kind === 'bait') {
      wild.bait = true;
      wild.rock = false;
    } else {
      wild.bait = false;
      wild.rock = true;
    }

    const pokemonData = MasterData.getPokemon(wild.pokedexId);
    if (!pokemonData) {
      throw new AppError('Pokemon data not found', 500, AppErrorCode.INTERNAL_SERVER_ERROR);
    }

    // 도망 확률만 계산 (bait 우선)
    let fleeMul = 1.0;
    if (wild.bait) fleeMul = 0.5;
    else if (wild.rock) fleeMul = 2.0;

    const finalFlee = Math.min(pokemonData.rateFlee * fleeMul, 0.9);
    const fled = Math.random() < finalFlee;

    if (fled) wild.caught = 2;
    await setSafariMapData(authId, mapId, mapData);

    return { result: fled ? 'flee' : 'stay' };
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

    const finalCapture = Math.min(
      rateCapture * captureMul + partyBonus,
      LEVEL_CURVE.CAPTURE_RATE_CAP,
    );
    const finalFlee = Math.min(rateFlee * fleeMul, LEVEL_CURVE.FLEE_RATE_CAP);

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
      const lvlBonus = LEVEL_CURVE.partyLevelBonus(p.level);
      const shinyBonus = p.isShiny ? 0.03 : 0;
      const tBonus = tierBonus[p.tier] ?? 0;
      maxBonus = Math.max(maxBonus, lvlBonus + shinyBonus + tBonus);
    }

    return maxBonus;
  }

  async exit(authId: string): Promise<{ mapId: string; entry: { x: number; y: number } }> {
    // 1. 현재 사파리 존에 있는지 확인
    const userState = await getUserState(authId);
    if (!userState || !userState.mapId.startsWith('s')) {
      throw new AppError('Not in safari zone', 400, AppErrorCode.NOT_IN_SAFARI);
    }

    // 2. 사파리 데이터 전체 삭제
    await deleteAllSafariData(authId);

    // 3. p001로 위치 이동
    const p001 = MasterData.getMap('p001');
    const entry = p001?.entry ?? { x: UserStartLocation.x, y: UserStartLocation.y };
    await updateUserStateMap(authId, {
      mapId: 'p001',
      x: String(entry.x),
      y: String(entry.y),
      lastMoveTime: String(Date.now()),
    });

    return { mapId: 'p001', entry };
  }
}
