import { sql, eq, and, inArray, isNotNull } from 'drizzle-orm';
import { db } from '@poposerver/lib/db';
import { user, userItem, userPokemon, userPokedex } from '@poposerver/lib/schema';
import { MasterData } from '@poposerver/lib/utils/master-data';
import {
  getPosition,
  setPosition,
  deleteAllSafariData,
  SafariWild,
  SafariItem,
  getWild,
  updateWild,
  deleteWild,
  getAllWildsWithCleanup,
  setSafariItems,
  getSafariItems,
  addSafariActive,
  publishWildDespawn,
  getGameTime,
} from '@poposerver/lib/state';
import {
  POKEMON_LEVEL_MAX,
  calcCaptureExp,
  levelFromExp,
  totalExpForLevel,
} from '@poposerver/lib/utils/exp-curve';
import {
  bumpDailyCaptureCount,
  grantUserExp,
  type UserExpGrantResult,
} from '@poposerver/lib/utils/user-exp';
import {
  applyDailyCaptureMultiplier,
  calcUserCaptureExp,
  isWithinCatchLevelCap,
  userLevelFromExp,
} from '@poposerver/lib/utils/user-exp-curve';
import { pickExpCandyDrop } from '@poposerver/lib/utils/exp-candy-drop';
import { resolveTier } from '@poposerver/lib/utils/tier';
import {
  PokemonTier,
  AppErrorCode,
  AuditAction,
  UserStartLocation,
  S000_MAP_ID,
  POST_S000_LOCATION,
  S000_REWARD_ITEM_ID,
  S000_REWARD_QUANTITY,
  S000_REWARD_TICKET_ID,
  S000_REWARD_TICKET_QUANTITY,
  SAFARI_ENTRY_BALL_ID,
  PokemonSpawnTile,
  PokemonData,
} from '@poposerver/lib/types';
import { AppError } from '@poposerver/lib/utils/error';
import { auditTx, auditAsync, type Tx } from '@poposerver/lib/utils/audit';
import { redisRetry, withRedisRetry } from '@poposerver/lib/redis-retry';
import { LEVEL_CURVE } from '@poposerver/lib/constants/level-curve';
import { PC_STORAGE, PC_BOX_CAPACITY } from '@poposerver/lib/constants/pc';
import {
  BALL_NUMBERS,
  BallId,
  FRIEND_BALL_FRIENDSHIP,
  SAFARI_BALL_ID,
  ballCaptureMul,
} from '@poposerver/lib/constants/ball';
import { trainerRankStepOf } from '@poposerver/lib/constants/trainer-rank';
import { ensureSafariBucket } from './safari-world';

type CatchResult = 'caught' | 'fail' | 'flee';
type FleeResult = 'flee' | 'stay';
type CatchFailReason = 'break_out' | 'flee' | 'expired';

const SAFARI_ZONE_TICKET_ID = 'safari-zone-ticket';
const GUMMI_MATCH_CAPTURE_MUL = 1.5;
const GUMMI_MISMATCH_CAPTURE_MUL = 1.15;
const MUD_CAPTURE_MUL = 1.5;
const MUD_FLEE_MUL = 1.5;
const BALM_FLEE_MUL = 0.7;

type ToolItemId = 'mud' | 'balm';

interface SafariBallGrant {
  itemId: string;
  quantity: number;
  newQuantity: number;
}

export class SafariService {
  async enter(
    authId: string,
    mapId: string,
    needEntry: boolean,
    receivedAt: number,
    ip?: string,
  ): Promise<{
    mapData: { wilds: SafariWild[]; items: SafariItem[] };
    entry?: { x: number; y: number };
    ballGrant?: SafariBallGrant;
  }> {
    // 1-a. 검증: 현재 사용자가 plaza 또는 safari에 있는지 확인
    const position = getPosition(authId);
    if (!position) {
      throw new AppError('Must be in plaza to enter safari', 400, AppErrorCode.NOT_IN_PLAZA);
    }

    const currentPrefix = position.mapId[0];
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

    const retry = redisRetry(`safari.enter authId=${authId}`, receivedAt);
    // 2. 버킷 생성(첫 진입)/유지(재진입)를 ensureSafariBucket에 위임 — 소켓 조인과 공유하는 유일한 생성 지점.
    const createBucket = () => ensureSafariBucket(authId, mapId, retry, 'api', ip);
    let ballGrant: SafariBallGrant | undefined;
    if (needEntry && currentPrefix === 'p' && mapId !== S000_MAP_ID) {
      ballGrant = await this.consumeTicketAndGrantBalls(Number(authId), mapId, createBucket, ip);
    } else {
      await createBucket();
    }

    const [wilds, storedItems] = await withRedisRetry(retry, () =>
      Promise.all([getAllWildsWithCleanup(authId, mapId), getSafariItems(authId, mapId)]),
    );
    const items = storedItems ?? [];
    // safari:active 인덱스가 어떤 이유로든 빠져있을 수 있으니 idempotent하게 보장
    await addSafariActive(authId, mapId);

    const mapData = { wilds, items };

    if (needEntry) {
      const entry = targetMap.entry ?? { x: UserStartLocation.x, y: UserStartLocation.y };
      setPosition(authId, { mapId, x: entry.x, y: entry.y });
      return { mapData, entry, ballGrant };
    }

    return { mapData };
  }

  async pickItem(
    authId: string,
    uid: string,
    receivedAt: number,
  ): Promise<{ itemId: string; newQuantity: number }> {
    const position = getPosition(authId);
    if (!position || !position.mapId.startsWith('s')) {
      throw new AppError('Not in safari zone', 400, AppErrorCode.NOT_IN_SAFARI);
    }

    const mapId = position.mapId;
    const retry = redisRetry(`safari.pickItem authId=${authId}`, receivedAt);
    const items = await withRedisRetry(retry, () => getSafariItems(authId, mapId));
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

    const accountId = Number(authId);
    const result = await db.transaction(async (tx) => {
      const [row] = await tx
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
      await withRedisRetry(retry, () => setSafariItems(authId, mapId, items));
      return row;
    });

    return {
      itemId: targetItem.itemId,
      newQuantity: result.quantity,
    };
  }

  async catchWild(
    authId: string,
    uid: string,
    ballId: BallId,
    spawnTile: PokemonSpawnTile | null,
    receivedAt: number,
    ip?: string,
  ): Promise<{
    result: CatchResult | 'level_cap';
    pokemon?: typeof userPokemon.$inferSelect;
    rewards?: Array<{ itemId: string; quantity: number }>;
    partyExp?: Array<{
      id: number;
      gained: number;
      level: number;
      exp: number;
      leveledUp: boolean;
    }>;
    partyFriendship?: Array<{ id: number; friendship: number }>;
    userExp?: UserExpGrantResult;
  }> {
    const accountId = Number(authId);

    const position = getPosition(authId);
    if (!position || !position.mapId.startsWith('s')) {
      throw new AppError('Not in safari zone', 400, AppErrorCode.NOT_IN_SAFARI);
    }

    const mapId = position.mapId;

    if (mapId === S000_MAP_ID && ballId !== SAFARI_BALL_ID) {
      throw new AppError('Only safari balls in s000', 400, AppErrorCode.DTO_INVALID);
    }

    const [ownedBall] = await db
      .select({ quantity: userItem.quantity })
      .from(userItem)
      .where(and(eq(userItem.accountId, accountId), eq(userItem.itemId, ballId)));

    if (!ownedBall || ownedBall.quantity <= 0) {
      throw new AppError('No balls', 400, AppErrorCode.SAFARI_BALL_NOT_FOUND);
    }

    const [userRow] = await db
      .select({ hasStarter: user.hasStarter, exp: user.exp })
      .from(user)
      .where(eq(user.accountId, accountId));
    const isS000Starter = mapId === S000_MAP_ID && !!userRow?.hasStarter;

    const retry = redisRetry(`safari.catchWild authId=${authId}`, receivedAt);
    const wild = await withRedisRetry(retry, () => getWild(authId, mapId, uid));
    if (!wild) {
      await this.consumeBall(db, accountId, ballId, ownedBall.quantity);

      this.auditCatchAttempt(accountId, mapId, uid, null, ballId, spawnTile, ip);
      this.auditCatchFail(accountId, mapId, uid, null, 'expired', ip);
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

    if (!isS000Starter && !isWithinCatchLevelCap(wild.level, userLevelFromExp(userRow?.exp ?? 0))) {
      return { result: 'level_cap' };
    }

    // 파티 포켓몬 보너스 (응답/보너스 계산 모두 슬롯 순서를 따른다)
    const partyPokemons = await db
      .select({
        id: userPokemon.id,
        pokedexId: userPokemon.pokedexId,
        level: userPokemon.level,
        exp: userPokemon.exp,
        isShiny: userPokemon.isShiny,
        tier: userPokemon.tier,
        gender: userPokemon.gender,
      })
      .from(userPokemon)
      .where(and(eq(userPokemon.accountId, accountId), isNotNull(userPokemon.partySlot)))
      .orderBy(userPokemon.partySlot);

    const [boxCountRow] = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(userPokemon)
      .where(and(eq(userPokemon.accountId, accountId), isNotNull(userPokemon.boxNumber)));
    if (
      (boxCountRow?.count ?? 0) >= PC_BOX_CAPACITY &&
      partyPokemons.length >= LEVEL_CURVE.PARTY_SLOT_COUNT
    ) {
      throw new AppError('Pokemon storage is full', 409, AppErrorCode.POKEMON_BOX_FULL);
    }

    const partyIds = partyPokemons.map((p) => p.id);
    let partyBonus = 0;

    let partyFriendship: Array<{ id: number; friendship: number }> = [];

    if (partyIds.length > 0) {
      const bonusData = partyPokemons.map((p) => {
        const masterPokemon = MasterData.getPokemon(String(p.pokedexId));
        return {
          level: p.level,
          isShiny: p.isShiny,
          tier: resolveTier(p.tier, (masterPokemon?.tier ?? 'common') as PokemonTier),
        };
      });

      partyBonus = this.calculatePartyBonus(bonusData);
    }

    this.auditCatchAttempt(accountId, mapId, uid, wild, ballId, spawnTile, ip, partyBonus);

    let result: CatchResult;
    if (isS000Starter) {
      result = 'caught';
    } else {
      const ballMul = await this.resolveBallMul(ballId, {
        accountId,
        mapId,
        wild,
        pokemonData,
        trainerLevel: userLevelFromExp(userRow?.exp ?? 0),
        lead: partyPokemons[0] ?? null,
        spawnTile,
      });
      result = this.calculateCatchResult(
        pokemonData.rateCapture,
        pokemonData.rateFlee,
        wild.feed ? this.gummiCaptureMul(wild.feed, [pokemonData.type1, pokemonData.type2]) : null,
        wild.mud,
        wild.balm,
        partyBonus,
        ballMul,
      );
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
        candyQuantity = LEVEL_CURVE.CANDY_BY_TIER[pokemonData.tier] ?? 3;
      }

      let insertedPokemon: typeof userPokemon.$inferSelect;
      const partyExpResults: Array<{
        id: number;
        gained: number;
        level: number;
        exp: number;
        leveledUp: boolean;
      }> = [];
      let userExpResult: UserExpGrantResult;
      const rewards: Array<{ itemId: string; quantity: number }> = [];
      if (candyQuantity > 0) {
        rewards.push({ itemId: candyId, quantity: candyQuantity });
      }

      await db.transaction(async (tx) => {
        if (ownedBall.quantity === 1) {
          await tx
            .delete(userItem)
            .where(and(eq(userItem.accountId, accountId), eq(userItem.itemId, ballId)));
        } else {
          await tx
            .update(userItem)
            .set({ quantity: sql`${userItem.quantity} - 1` })
            .where(and(eq(userItem.accountId, accountId), eq(userItem.itemId, ballId)));
        }

        const existingPartySlots = await tx
          .select({ partySlot: userPokemon.partySlot })
          .from(userPokemon)
          .where(and(eq(userPokemon.accountId, accountId), isNotNull(userPokemon.partySlot)));

        const occupiedPartySlots = new Set(existingPartySlots.map((p) => p.partySlot));

        let targetPartySlot: number | null = null;
        for (let s = 0; s < LEVEL_CURVE.PARTY_SLOT_COUNT; s++) {
          if (!occupiedPartySlots.has(s)) {
            targetPartySlot = s;
            break;
          }
        }

        let targetBox: number | null = null;
        let targetGrid: number | null = null;

        if (targetPartySlot === null) {
          const existingBoxPokemon = await tx
            .select({ boxNumber: userPokemon.boxNumber, gridNumber: userPokemon.gridNumber })
            .from(userPokemon)
            .where(and(eq(userPokemon.accountId, accountId), isNotNull(userPokemon.boxNumber)));

          const occupied = new Set(existingBoxPokemon.map((p) => `${p.boxNumber}:${p.gridNumber}`));

          outer: for (let b = 1; b <= PC_STORAGE.MAX_BOX; b++) {
            for (let g = 0; g < PC_STORAGE.GRID_PER_BOX; g++) {
              if (!occupied.has(`${b}:${g}`)) {
                targetBox = b;
                targetGrid = g;
                break outer;
              }
            }
          }

          if (targetBox === null) {
            throw new AppError('Pokemon storage is full', 409, AppErrorCode.POKEMON_BOX_FULL);
          }
        }

        const [inserted] = await tx
          .insert(userPokemon)
          .values({
            accountId,
            pokedexId: wild.pokedexId,
            level: wild.level,
            exp: totalExpForLevel(wild.level, pokemonData.growthGroup),
            gender: wild.gender,
            isShiny: wild.isShiny,
            nickname: null,
            abilityId: wild.ability,
            natureId: wild.nature,
            skills: [],
            heldItemId: null,
            boxNumber: targetBox,
            gridNumber: targetGrid,
            partySlot: targetPartySlot,
            ballId: BALL_NUMBERS[ballId],
            friendship: ballId === 'friend-ball' ? FRIEND_BALL_FRIENDSHIP : 0,
            caughtLocation: position.mapId,
          })
          .returning();

        insertedPokemon = inserted;

        await auditTx(tx, {
          accountId,
          action: AuditAction.POKEMON_CATCH,
          detail: {
            userPokemonId: inserted.id,
            pokedexId: wild.pokedexId,
            level: wild.level,
            isShiny: wild.isShiny,
            mapId,
            isS000Starter,
          },
          ip: ip ?? null,
          source: 'api',
        });

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

        if (isS000Starter && S000_REWARD_TICKET_QUANTITY > 0) {
          await tx
            .insert(userItem)
            .values({
              accountId,
              itemId: S000_REWARD_TICKET_ID,
              quantity: S000_REWARD_TICKET_QUANTITY,
            })
            .onConflictDoUpdate({
              target: [userItem.accountId, userItem.itemId],
              set: { quantity: sql`${userItem.quantity} + ${S000_REWARD_TICKET_QUANTITY}` },
            });
          rewards.push({ itemId: S000_REWARD_TICKET_ID, quantity: S000_REWARD_TICKET_QUANTITY });
        }

        // 경험사탕 드롭 (S000 스타터는 제외)
        if (!isS000Starter) {
          const drop = pickExpCandyDrop(pokemonData.tier, wild.level);
          await tx
            .insert(userItem)
            .values({ accountId, itemId: drop.itemId, quantity: drop.quantity })
            .onConflictDoUpdate({
              target: [userItem.accountId, userItem.itemId],
              set: { quantity: sql`${userItem.quantity} + ${drop.quantity}` },
            });
          if (drop.quantity > 0) {
            rewards.push({ itemId: drop.itemId, quantity: drop.quantity });
          }
        }

        // 파티 EXP 분배 (Gen 5+ 스케일링, s = 파티 수)
        if (partyPokemons.length > 0 && pokemonData.baseExp > 0) {
          const s = partyPokemons.length;
          for (const member of partyPokemons) {
            const memberMaster = MasterData.getPokemon(String(member.pokedexId));
            if (!memberMaster) continue;
            if (member.level >= POKEMON_LEVEL_MAX) {
              partyExpResults.push({
                id: member.id,
                gained: 0,
                level: member.level,
                exp: member.exp,
                leveledUp: false,
              });
              continue;
            }
            const gained = calcCaptureExp(pokemonData.baseExp, wild.level, s, member.level);
            const cap = totalExpForLevel(POKEMON_LEVEL_MAX, memberMaster.growthGroup);

            const baseExp = Math.max(
              member.exp,
              totalExpForLevel(member.level, memberMaster.growthGroup),
            );
            const newExp = Math.min(baseExp + gained, cap);
            const newLevel = levelFromExp(newExp, memberMaster.growthGroup);
            await tx
              .update(userPokemon)
              .set({ exp: newExp, level: newLevel })
              .where(and(eq(userPokemon.id, member.id), eq(userPokemon.accountId, accountId)));
            partyExpResults.push({
              id: member.id,
              gained,
              level: newLevel,
              exp: newExp,
              leveledUp: newLevel > member.level,
            });
          }
        }

        const { nth, exp: userTotalExp } = await bumpDailyCaptureCount(tx, accountId, new Date());
        const baseUserExp = calcUserCaptureExp(
          pokemonData.tier,
          wild.level,
          userLevelFromExp(userTotalExp),
        );
        userExpResult = await grantUserExp(
          tx,
          accountId,
          applyDailyCaptureMultiplier(baseUserExp, nth),
          'capture',
        );

        if (partyIds.length > 0) {
          partyFriendship = await tx
            .update(userPokemon)
            .set({ friendship: sql`LEAST(${userPokemon.friendship} + 2, 255)` })
            .where(and(eq(userPokemon.accountId, accountId), inArray(userPokemon.id, partyIds)))
            .returning({ id: userPokemon.id, friendship: userPokemon.friendship });
        }

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

        await withRedisRetry(retry, () =>
          isS000Starter ? deleteAllSafariData(authId) : deleteWild(authId, mapId, wild.uid),
        );
      });

      await publishWildDespawn({ authId, mapId, wildUid: wild.uid, reason: 'caught' });

      if (isS000Starter) {
        setPosition(authId, {
          mapId: POST_S000_LOCATION.map,
          x: POST_S000_LOCATION.x,
          y: POST_S000_LOCATION.y,
        });
      }

      return {
        result,
        pokemon: insertedPokemon!,
        rewards,
        partyExp: partyExpResults,
        partyFriendship,
        userExp: userExpResult!,
      };
    } else {
      if (result === 'flee') {
        wild.caught = 2;
      } else {
        wild.turn += 1;
      }
      await db.transaction(async (tx) => {
        await this.consumeBall(tx, accountId, ballId, ownedBall.quantity);
        await withRedisRetry<unknown>(retry, () =>
          result === 'flee' ? deleteWild(authId, mapId, wild.uid) : updateWild(authId, mapId, wild),
        );
      });
      if (result === 'flee') {
        await publishWildDespawn({ authId, mapId, wildUid: wild.uid, reason: 'fled' });
        this.auditCatchFail(accountId, mapId, uid, wild, 'flee', ip);
      } else {
        this.auditCatchFail(accountId, mapId, uid, wild, 'break_out', ip);
      }
      return { result };
    }
  }

  private async resolveBallMul(
    ballId: BallId,
    input: {
      accountId: number;
      mapId: string;
      wild: SafariWild;
      pokemonData: PokemonData;
      trainerLevel: number;
      lead: { pokedexId: string; gender: number } | null;
      spawnTile: PokemonSpawnTile | null;
    },
  ): Promise<number> {
    const { accountId, mapId, wild, pokemonData } = input;

    let caughtBefore = false;
    if (ballId === 'repeat-ball') {
      const [row] = await db
        .select({ caughtCount: userPokedex.caughtCount })
        .from(userPokedex)
        .where(
          and(eq(userPokedex.accountId, accountId), eq(userPokedex.pokedexId, wild.pokedexId)),
        );
      caughtBefore = (row?.caughtCount ?? 0) > 0;
    }

    const gameTime = getGameTime();

    return ballCaptureMul(ballId, {
      pokedexId: wild.pokedexId,
      level: wild.level,
      gender: wild.gender,
      turn: wild.turn,
      types: [pokemonData.type1, pokemonData.type2],
      weightKg: pokemonData.weightKg,
      trainerLevel: input.trainerLevel,
      lead: input.lead,
      caughtBefore,
      mapId,
      timeOfDay: gameTime.phase,
      moonPhase: gameTime.moonPhase,
      spawnTile: input.spawnTile,
    });
  }

  private auditCatchAttempt(
    accountId: number,
    mapId: string,
    uid: string,
    wild: SafariWild | null,
    ballId: BallId,
    spawnTile: PokemonSpawnTile | null,
    ip?: string,
    partyBonus?: number,
  ): void {
    void auditAsync({
      accountId,
      action: AuditAction.POKEMON_CATCH_ATTEMPT,
      detail: {
        mapId,
        wildUid: uid,
        ballId,
        spawnTile,
        pokedexId: wild?.pokedexId ?? null,
        level: wild?.level ?? null,
        isShiny: wild?.isShiny ?? null,
        feed: wild?.feed ?? null,
        mud: wild?.mud ?? null,
        balm: wild?.balm ?? null,
        partyBonus: partyBonus ?? null,
      },
      ip: ip ?? null,
      source: 'api',
    });
  }

  private auditCatchFail(
    accountId: number,
    mapId: string,
    uid: string,
    wild: SafariWild | null,
    reason: CatchFailReason,
    ip?: string,
  ): void {
    void auditAsync({
      accountId,
      action: AuditAction.POKEMON_CATCH_FAIL,
      detail: {
        mapId,
        wildUid: uid,
        pokedexId: wild?.pokedexId ?? null,
        level: wild?.level ?? null,
        isShiny: wild?.isShiny ?? null,
        reason,
        fled: reason !== 'break_out',
      },
      ip: ip ?? null,
      source: 'api',
    });
  }

  private async consumeTicketAndGrantBalls(
    accountId: number,
    mapId: string,
    afterConsume: () => Promise<unknown>,
    ip?: string,
  ): Promise<SafariBallGrant> {
    return db.transaction(async (tx) => {
      const [ticket] = await tx
        .select({ quantity: userItem.quantity })
        .from(userItem)
        .where(and(eq(userItem.accountId, accountId), eq(userItem.itemId, SAFARI_ZONE_TICKET_ID)))
        .for('update');

      if (!ticket || ticket.quantity <= 0) {
        throw new AppError('No safari zone ticket', 400, AppErrorCode.SAFARI_TICKET_NOT_FOUND);
      }

      if (ticket.quantity === 1) {
        await tx
          .delete(userItem)
          .where(
            and(eq(userItem.accountId, accountId), eq(userItem.itemId, SAFARI_ZONE_TICKET_ID)),
          );
      } else {
        await tx
          .update(userItem)
          .set({ quantity: sql`${userItem.quantity} - 1` })
          .where(
            and(eq(userItem.accountId, accountId), eq(userItem.itemId, SAFARI_ZONE_TICKET_ID)),
          );
      }

      const [userRow] = await tx
        .select({ exp: user.exp })
        .from(user)
        .where(eq(user.accountId, accountId));
      const level = userLevelFromExp(userRow?.exp ?? 0);
      const rank = trainerRankStepOf(level);
      const quantity = rank.safariEntryBalls;

      const [ball] = await tx
        .insert(userItem)
        .values({ accountId, itemId: SAFARI_ENTRY_BALL_ID, quantity })
        .onConflictDoUpdate({
          target: [userItem.accountId, userItem.itemId],
          set: { quantity: sql`${userItem.quantity} + ${quantity}` },
        })
        .returning({ quantity: userItem.quantity });

      await auditTx(tx, {
        accountId,
        action: AuditAction.SAFARI_ENTER,
        detail: {
          mapId,
          ticketConsumed: true,
          level,
          rank: rank.key,
          ballsGranted: quantity,
        },
        ip: ip ?? null,
        source: 'api',
      });

      await afterConsume();

      return { itemId: SAFARI_ENTRY_BALL_ID, quantity, newQuantity: ball.quantity };
    });
  }

  private async consumeBall(
    executor: typeof db | Tx,
    accountId: number,
    ballId: BallId,
    currentQuantity: number,
  ): Promise<void> {
    if (currentQuantity === 1) {
      await executor
        .delete(userItem)
        .where(and(eq(userItem.accountId, accountId), eq(userItem.itemId, ballId)));
    } else {
      await executor
        .update(userItem)
        .set({ quantity: sql`${userItem.quantity} - 1` })
        .where(and(eq(userItem.accountId, accountId), eq(userItem.itemId, ballId)));
    }
  }

  async feedWild(
    authId: string,
    uid: string,
    itemId: string,
    receivedAt: number,
    ip?: string,
  ): Promise<{ result: FleeResult; itemId: string; quantity: number }> {
    const accountId = Number(authId);

    const itemData = MasterData.getItem(itemId);
    if (!itemData || itemData.category !== 'gummi') {
      throw new AppError('Item not found', 404, AppErrorCode.ITEM_NOT_FOUND);
    }

    const position = getPosition(authId);
    if (!position || !position.mapId.startsWith('s')) {
      throw new AppError('Not in safari zone', 400, AppErrorCode.NOT_IN_SAFARI);
    }

    const mapId = position.mapId;
    const retry = redisRetry(`safari.feedWild authId=${authId}`, receivedAt);
    const wild = await withRedisRetry(retry, () => getWild(authId, mapId, uid));
    if (!wild) {
      return { result: 'flee', itemId, quantity: await this.getItemQuantity(accountId, itemId) };
    }
    if (wild.caught === 1) {
      throw new AppError('Already caught', 409, AppErrorCode.SAFARI_WILD_ALREADY_CAUGHT);
    }
    if (wild.caught === 2) {
      throw new AppError('Already fled', 409, AppErrorCode.SAFARI_WILD_ALREADY_FLED);
    }
    if (wild.feed !== null) {
      throw new AppError('Already fed', 409, AppErrorCode.SAFARI_WILD_ALREADY_FED);
    }

    const pokemonData = MasterData.getPokemon(wild.pokedexId);
    if (!pokemonData) {
      throw new AppError('Pokemon data not found', 500, AppErrorCode.INTERNAL_SERVER_ERROR);
    }

    const finalFlee = Math.min(
      pokemonData.rateFlee * this.wildFleeMul(wild.mud, wild.balm),
      LEVEL_CURVE.FLEE_RATE_CAP,
    );
    const fled = mapId === S000_MAP_ID ? false : Math.random() < finalFlee;
    const result: FleeResult = fled ? 'flee' : 'stay';

    if (fled) {
      wild.caught = 2;
    } else {
      wild.feed = itemId;
      wild.turn += 1;
    }

    const quantity = await this.consumeWildItem(
      accountId,
      itemId,
      AuditAction.SAFARI_FEED,
      { mapId, wildUid: uid, pokedexId: wild.pokedexId, itemId, result },
      () =>
        withRedisRetry<unknown>(retry, () =>
          fled ? deleteWild(authId, mapId, wild.uid) : updateWild(authId, mapId, wild),
        ),
      ip,
    );

    if (fled) {
      await publishWildDespawn({ authId, mapId, wildUid: wild.uid, reason: 'fled' });
    }

    return { result, itemId, quantity };
  }

  async useItemWild(
    authId: string,
    uid: string,
    itemId: ToolItemId,
    receivedAt: number,
    ip?: string,
  ): Promise<{ result: FleeResult; itemId: string; quantity: number }> {
    const accountId = Number(authId);

    const itemData = MasterData.getItem(itemId);
    if (!itemData || itemData.category !== 'tool') {
      throw new AppError('Item not found', 404, AppErrorCode.ITEM_NOT_FOUND);
    }

    const position = getPosition(authId);
    if (!position || !position.mapId.startsWith('s')) {
      throw new AppError('Not in safari zone', 400, AppErrorCode.NOT_IN_SAFARI);
    }

    const mapId = position.mapId;
    const retry = redisRetry(`safari.useItemWild authId=${authId}`, receivedAt);
    const wild = await withRedisRetry(retry, () => getWild(authId, mapId, uid));
    if (!wild) {
      return { result: 'flee', itemId, quantity: await this.getItemQuantity(accountId, itemId) };
    }
    if (wild.caught === 1) {
      throw new AppError('Already caught', 409, AppErrorCode.SAFARI_WILD_ALREADY_CAUGHT);
    }
    if (wild.caught === 2) {
      throw new AppError('Already fled', 409, AppErrorCode.SAFARI_WILD_ALREADY_FLED);
    }
    if (itemId === 'mud' && wild.mud) {
      throw new AppError('Already mudded', 409, AppErrorCode.SAFARI_WILD_ALREADY_MUDDED);
    }
    if (itemId === 'balm' && wild.balm) {
      throw new AppError('Already balmed', 409, AppErrorCode.SAFARI_WILD_ALREADY_BALMED);
    }

    const pokemonData = MasterData.getPokemon(wild.pokedexId);
    if (!pokemonData) {
      throw new AppError('Pokemon data not found', 500, AppErrorCode.INTERNAL_SERVER_ERROR);
    }

    const finalFlee = Math.min(
      pokemonData.rateFlee *
        this.wildFleeMul(itemId === 'mud' || wild.mud, itemId === 'balm' || wild.balm),
      LEVEL_CURVE.FLEE_RATE_CAP,
    );
    const fled = mapId === S000_MAP_ID ? false : Math.random() < finalFlee;
    const result: FleeResult = fled ? 'flee' : 'stay';

    if (fled) {
      wild.caught = 2;
    } else {
      if (itemId === 'mud') {
        wild.mud = true;
      } else {
        wild.balm = true;
      }
      wild.turn += 1;
    }

    const quantity = await this.consumeWildItem(
      accountId,
      itemId,
      AuditAction.SAFARI_USE_ITEM,
      { mapId, wildUid: uid, pokedexId: wild.pokedexId, itemId, result },
      () =>
        withRedisRetry<unknown>(retry, () =>
          fled ? deleteWild(authId, mapId, wild.uid) : updateWild(authId, mapId, wild),
        ),
      ip,
    );

    if (fled) {
      await publishWildDespawn({ authId, mapId, wildUid: wild.uid, reason: 'fled' });
    }

    return { result, itemId, quantity };
  }

  private async consumeWildItem(
    accountId: number,
    itemId: string,
    action: AuditAction,
    detail: Record<string, unknown>,
    afterConsume: () => Promise<unknown>,
    ip?: string,
  ): Promise<number> {
    return db.transaction(async (tx) => {
      const [owned] = await tx
        .select({ quantity: userItem.quantity })
        .from(userItem)
        .where(and(eq(userItem.accountId, accountId), eq(userItem.itemId, itemId)))
        .for('update');

      if (!owned || owned.quantity <= 0) {
        throw new AppError(
          'Insufficient item quantity',
          400,
          AppErrorCode.ITEM_INSUFFICIENT_QUANTITY,
        );
      }

      if (owned.quantity === 1) {
        await tx
          .delete(userItem)
          .where(and(eq(userItem.accountId, accountId), eq(userItem.itemId, itemId)));
      } else {
        await tx
          .update(userItem)
          .set({ quantity: sql`${userItem.quantity} - 1` })
          .where(and(eq(userItem.accountId, accountId), eq(userItem.itemId, itemId)));
      }

      await auditTx(tx, {
        accountId,
        action,
        detail,
        ip: ip ?? null,
        source: 'api',
      });

      await afterConsume();

      return owned.quantity - 1;
    });
  }

  private wildFleeMul(mud: boolean, balm: boolean): number {
    return (mud ? MUD_FLEE_MUL : 1) * (balm ? BALM_FLEE_MUL : 1);
  }

  private async getItemQuantity(accountId: number, itemId: string): Promise<number> {
    const [row] = await db
      .select({ quantity: userItem.quantity })
      .from(userItem)
      .where(and(eq(userItem.accountId, accountId), eq(userItem.itemId, itemId)));
    return row?.quantity ?? 0;
  }

  private gummiCaptureMul(itemId: string, wildTypes: Array<string | null>): number {
    const gummiType = itemId.replace(/-gummi$/, '');
    return wildTypes.includes(gummiType) ? GUMMI_MATCH_CAPTURE_MUL : GUMMI_MISMATCH_CAPTURE_MUL;
  }

  private calculateCatchResult(
    rateCapture: number,
    rateFlee: number,
    feedCaptureMul: number | null,
    mud: boolean,
    balm: boolean,
    partyBonus: number,
    ballMul: number,
  ): CatchResult {
    const captureMul = (feedCaptureMul ?? 1) * (mud ? MUD_CAPTURE_MUL : 1);
    const fleeMul = this.wildFleeMul(mud, balm);

    const finalCapture = Math.min(
      (rateCapture * captureMul + partyBonus) * ballMul,
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

    let sum = 0;
    for (const p of partyPokemons) {
      const lvlBonus = LEVEL_CURVE.partyLevelBonus(p.level);
      const shinyBonus = p.isShiny ? LEVEL_CURVE.PARTY_SHINY_BONUS : 0;
      const tBonus = LEVEL_CURVE.PARTY_TIER_BONUS[p.tier] ?? 0;
      sum += lvlBonus + shinyBonus + tBonus;
    }

    return sum / LEVEL_CURVE.PARTY_SLOT_COUNT;
  }

  async exit(
    authId: string,
    receivedAt: number,
  ): Promise<{ mapId: string; entry: { x: number; y: number }; fromMapId: string }> {
    const position = getPosition(authId);
    if (!position || !position.mapId.startsWith('s')) {
      throw new AppError('Not in safari zone', 400, AppErrorCode.NOT_IN_SAFARI);
    }

    const fromMapId = position.mapId;

    const retry = redisRetry(`safari.exit authId=${authId}`, receivedAt);
    await withRedisRetry(retry, () => deleteAllSafariData(authId));

    const p001 = MasterData.getMap('p001');
    const entry = p001?.entry ?? { x: UserStartLocation.x, y: UserStartLocation.y };
    setPosition(authId, { mapId: 'p001', x: entry.x, y: entry.y });

    return { mapId: 'p001', entry, fromMapId };
  }
}
