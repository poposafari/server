import crypto from 'crypto';
import { sql, eq, and, inArray, isNotNull } from 'drizzle-orm';
import { db } from '@poposerver/lib/db';
import { user, userItem, userPokemon, userPokedex } from '@poposerver/lib/schema';
import { MasterData } from '@poposerver/lib/utils/master-data';
import {
  getGameTime,
  getUserState,
  updateUserStateMap,
  deleteAllSafariData,
  SafariWild,
  SafariItem,
  addWild,
  getWild,
  updateWild,
  deleteWild,
  getAllWildsWithCleanup,
  listWildIds,
  setSafariItems,
  getSafariItems,
  addSafariActive,
  publishWildDespawn,
  RedisClient,
  RedisKey,
} from '@poposerver/lib/redis';
import { generateWildBatch, randomWildTtlSec } from '@poposerver/lib/utils/wild-roll';
import { randomInt, pickRandom } from '@poposerver/lib/utils/rng';
import {
  TimeOfDay,
  Weather,
  PokemonTier,
  AppErrorCode,
  UserStartLocation,
  S000_MAP_ID,
  POST_S000_LOCATION,
  S000_REWARD_ITEM_ID,
  S000_REWARD_QUANTITY,
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
  ): Promise<{
    mapData: { wilds: SafariWild[]; items: SafariItem[] };
    entry?: { x: number; y: number };
  }> {
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

    if (mapId === S000_MAP_ID) {
      const [row] = await db
        .select({ hasStarter: user.hasStarter })
        .from(user)
        .where(eq(user.accountId, Number(authId)));
      if (!row || !row.hasStarter) {
        throw new AppError('No starter selection available', 400, AppErrorCode.NO_STARTER);
      }
    }

    // 2. 기존 wild 인덱스와 items 존재 여부로 첫 진입 / 재진입 구분
    const existingWildIds = await listWildIds(authId, mapId);
    const existingItems = await getSafariItems(authId, mapId);
    const isFirstEntry = existingWildIds.length === 0 && existingItems === null;

    let wilds: SafariWild[];
    let items: SafariItem[];

    if (isFirstEntry) {
      const [userRow] = await db
        .select({ level: user.level })
        .from(user)
        .where(eq(user.accountId, Number(authId)));
      const userLevel = userRow?.level ?? 1;

      const gameTime = await getGameTime();
      const timeOfDay = (gameTime?.phase ?? TimeOfDay.DAY) as TimeOfDay;
      const weather: Weather = Weather.SUNNY; // TODO: 날씨 시스템 구현 후 교체

      // 정책: 최초 진입 시 항상 max까지 스폰 (min은 고려하지 않음).
      const wildCount = targetMap.wild.max;
      wilds = await generateWildBatch(
        Number(authId),
        mapId,
        wildCount,
        userLevel,
        timeOfDay,
        weather,
      );

      if (wilds.length > 0) {
        const isS000 = mapId === S000_MAP_ID;
        const now = Date.now();
        const pipeline = RedisClient.pipeline();
        for (const w of wilds) {
          if (isS000) {
            w.expiresAt = undefined;
            pipeline.set(
              RedisKey.safariWild(authId, mapId, w.uid),
              JSON.stringify({ ...w, expiresAt: undefined }),
            );
          } else {
            const ttlSec = randomWildTtlSec();
            w.expiresAt = now + ttlSec * 1000;
            pipeline.set(
              RedisKey.safariWild(authId, mapId, w.uid),
              JSON.stringify({ ...w, expiresAt: undefined }),
              'EX',
              ttlSec,
            );
          }
        }
        pipeline.sadd(RedisKey.safariWildIds(authId, mapId), ...wilds.map((w) => w.uid));
        pipeline.sadd(RedisKey.safariVisited(authId), mapId);
        await pipeline.exec();
      } else {
        // pool이 비어 wild가 0개여도 방문 기록은 남긴다
        await RedisClient.sadd(RedisKey.safariVisited(authId), mapId);
      }

      // 아이템 생성
      const itemPool = targetMap.item.spawn ?? [];
      const itemCount = itemPool.length > 0 ? randomInt(targetMap.item.min, targetMap.item.max) : 0;
      const selectedItems = pickRandom(itemPool, itemCount);
      items = selectedItems.map((itemId) => ({
        uid: crypto.randomUUID(),
        itemId,
        picked: false,
      }));
      await setSafariItems(authId, mapId, items);

      await addSafariActive(authId, mapId);
    } else {
      wilds = await getAllWildsWithCleanup(authId, mapId);
      items = existingItems ?? [];
      // safari:active 인덱스가 어떤 이유로든 빠져있을 수 있으니 idempotent하게 보장
      await addSafariActive(authId, mapId);
    }

    const mapData = { wilds, items };

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

    return { mapData };
  }

  async pickItem(authId: string, uid: string): Promise<{ itemId: string; newQuantity: number }> {
    const userState = await getUserState(authId);
    if (!userState || !userState.mapId.startsWith('s')) {
      throw new AppError('Not in safari zone', 400, AppErrorCode.NOT_IN_SAFARI);
    }

    const mapId = userState.mapId;
    const items = await getSafariItems(authId, mapId);
    if (!items) {
      throw new AppError('Safari map data not found', 404, AppErrorCode.NOT_FOUND);
    }

    const itemIndex = items.findIndex((item) => item.uid === uid);
    if (itemIndex === -1) {
      throw new AppError('Item not found in current map', 404, AppErrorCode.SAFARI_ITEM_NOT_FOUND);
    }

    const targetItem = items[itemIndex];

    if (targetItem.picked) {
      throw new AppError('Item already picked', 409, AppErrorCode.SAFARI_ITEM_ALREADY_PICKED);
    }

    targetItem.picked = true;
    await setSafariItems(authId, mapId, items);

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

    const userState = await getUserState(authId);
    if (!userState || !userState.mapId.startsWith('s')) {
      throw new AppError('Not in safari zone', 400, AppErrorCode.NOT_IN_SAFARI);
    }

    const mapId = userState.mapId;

    const [safariBall] = await db
      .select({ quantity: userItem.quantity })
      .from(userItem)
      .where(and(eq(userItem.accountId, accountId), eq(userItem.itemId, 'safari-ball')));

    if (!safariBall || safariBall.quantity <= 0) {
      throw new AppError('No safari balls', 400, AppErrorCode.SAFARI_BALL_NOT_FOUND);
    }

    let isS000Starter = false;
    if (mapId === S000_MAP_ID) {
      const [row] = await db
        .select({ hasStarter: user.hasStarter })
        .from(user)
        .where(eq(user.accountId, accountId));
      isS000Starter = !!row?.hasStarter;
    }

    const wild = await getWild(authId, mapId, uid);
    if (!wild) {
      await this.consumeSafariBall(accountId, safariBall.quantity);
      return { result: 'flee' };
    }
    if (wild.caught === 1) {
      throw new AppError('Already caught', 409, AppErrorCode.SAFARI_WILD_ALREADY_CAUGHT);
    }
    if (wild.caught === 2) {
      throw new AppError('Already fled', 409, AppErrorCode.SAFARI_WILD_ALREADY_FLED);
    }

    const pokemonData = MasterData.getPokemon(wild.pokedexId);
    if (!pokemonData) {
      throw new AppError('Pokemon data not found', 500, AppErrorCode.INTERNAL_SERVER_ERROR);
    }

    // 파티 포켓몬 보너스
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

    const result: CatchResult = isS000Starter
      ? 'caught'
      : this.calculateCatchResult(
          pokemonData.rateCapture,
          pokemonData.rateFlee,
          wild.bait,
          wild.rock,
          partyBonus,
        );

    // 결과에 따른 Redis 업데이트
    if (result === 'fail') {
      wild.caught = 0;
      wild.bait = false;
      wild.rock = false;
      await updateWild(authId, mapId, wild);
    } else if (result === 'caught') {
      wild.caught = 1;
      // 즉시 디스폰: 키 삭제 + 디스폰 통지
      await deleteWild(authId, mapId, wild.uid);
      await publishWildDespawn({ authId, mapId, wildUid: wild.uid, reason: 'caught' });
    } else {
      wild.caught = 2;
      await deleteWild(authId, mapId, wild.uid);
      await publishWildDespawn({ authId, mapId, wildUid: wild.uid, reason: 'fled' });
    }

    // DB 트랜잭션
    if (result === 'caught') {
      let candyId: string;
      let candyQuantity: number;
      if (isS000Starter) {
        candyId = S000_REWARD_ITEM_ID;
        candyQuantity = S000_REWARD_QUANTITY;
      } else {
        candyId = `${pokemonData.type1}-candy`;
        const candyRanges: Record<string, [number, number]> = {
          common: [1, 3],
          rare: [3, 5],
          epic: [10, 20],
          legendary: [50, 100],
        };
        const [candyMin, candyMax] = candyRanges[pokemonData.tier] ?? [1, 3];
        candyQuantity = randomInt(candyMin, candyMax);
      }

      let insertedPokemon: typeof userPokemon.$inferSelect;
      let expReward: { gained: number; level: number; exp: number; leveledUp: boolean };

      await db.transaction(async (tx) => {
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

        const existingBoxPokemon = await tx
          .select({ boxNumber: userPokemon.boxNumber, gridNumber: userPokemon.gridNumber })
          .from(userPokemon)
          .where(and(eq(userPokemon.accountId, accountId), isNotNull(userPokemon.boxNumber)));

        const occupied = new Set(existingBoxPokemon.map((p) => `${p.boxNumber}:${p.gridNumber}`));

        let targetBox = 1;
        let targetGrid = 0;
        const MAX_BOX = 30;
        const GRID_PER_BOX = 30;

        outer: for (let b = 1; b <= MAX_BOX; b++) {
          for (let g = 0; g < GRID_PER_BOX; g++) {
            if (!occupied.has(`${b}:${g}`)) {
              targetBox = b;
              targetGrid = g;
              break outer;
            }
          }
        }

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

        await tx
          .insert(userPokedex)
          .values({ accountId, pokedexId: wild.pokedexId, caughtCount: 1 })
          .onConflictDoUpdate({
            target: [userPokedex.accountId, userPokedex.pokedexId],
            set: { caughtCount: sql`${userPokedex.caughtCount} + 1` },
          });

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

        if (isS000Starter) {
          await tx
            .update(user)
            .set({
              lastMapId: POST_S000_LOCATION.map,
              lastX: POST_S000_LOCATION.x,
              lastY: POST_S000_LOCATION.y,
              hasStarter: false,
            })
            .where(eq(user.accountId, accountId));
        }
      });

      if (isS000Starter) {
        await updateUserStateMap(authId, {
          mapId: POST_S000_LOCATION.map,
          x: String(POST_S000_LOCATION.x),
          y: String(POST_S000_LOCATION.y),
          lastMoveTime: String(Date.now()),
        });
        await deleteAllSafariData(authId);
      }

      return {
        result,
        pokemon: insertedPokemon!,
        reward: { candyId, candyQuantity },
        expReward: expReward!,
      };
    } else {
      await this.consumeSafariBall(accountId, safariBall.quantity);
      return { result };
    }
  }

  private async consumeSafariBall(accountId: number, currentQuantity: number): Promise<void> {
    if (currentQuantity === 1) {
      await db
        .delete(userItem)
        .where(and(eq(userItem.accountId, accountId), eq(userItem.itemId, 'safari-ball')));
    } else {
      await db
        .update(userItem)
        .set({ quantity: sql`${userItem.quantity} - 1` })
        .where(and(eq(userItem.accountId, accountId), eq(userItem.itemId, 'safari-ball')));
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
    const wild = await getWild(authId, mapId, uid);
    // 기획: TTL 만료로 Redis에 야생이 이미 없으면 bait/rock도 즉시 flee로 응답.
    if (!wild) {
      return { result: 'flee' };
    }
    if (wild.caught === 1) {
      throw new AppError('Already caught', 409, AppErrorCode.SAFARI_WILD_ALREADY_CAUGHT);
    }
    if (wild.caught === 2) {
      throw new AppError('Already fled', 409, AppErrorCode.SAFARI_WILD_ALREADY_FLED);
    }

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

    let fleeMul = 1.0;
    if (wild.bait) fleeMul = 0.5;
    else if (wild.rock) fleeMul = 2.0;

    const finalFlee = Math.min(pokemonData.rateFlee * fleeMul, 0.9);
    const fled = Math.random() < finalFlee;

    if (fled) {
      wild.caught = 2;
      await deleteWild(authId, mapId, wild.uid);
      await publishWildDespawn({ authId, mapId, wildUid: wild.uid, reason: 'fled' });
    } else {
      await updateWild(authId, mapId, wild);
    }

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
    const userState = await getUserState(authId);
    if (!userState || !userState.mapId.startsWith('s')) {
      throw new AppError('Not in safari zone', 400, AppErrorCode.NOT_IN_SAFARI);
    }

    await deleteAllSafariData(authId);

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
