import { eq, and, sql, inArray } from 'drizzle-orm';
import { db } from '@poposerver/lib/db';
import { userPokemon, userItem, userPokedex } from '@poposerver/lib/schema';
import { MasterData } from '@poposerver/lib/utils/master-data';
import { AppError } from '@poposerver/lib/utils/error';
import { auditTx } from '@poposerver/lib/utils/audit';
import { AppErrorCode, AuditAction, PokemonGender } from '@poposerver/lib/types';
import { getGameTime } from '@poposerver/lib/state';
import {
  EXP_CANDY_VALUE,
  POKEMON_LEVEL_MAX,
  expToNextLevel,
  isExpCandyId,
  levelFromExp,
  totalExpForLevel,
} from '@poposerver/lib/utils/exp-curve';
import { pickSellExpCandy } from '@poposerver/lib/utils/exp-candy-drop';
import { LEVEL_CURVE } from '@poposerver/lib/constants/level-curve';
import { PokemonRepository } from './pokemon.repository';

export class PokemonService {
  constructor(private readonly repo: PokemonRepository) {}

  async getBox(authId: string) {
    return this.repo.findBoxByAccountId(Number(authId));
  }

  async getBoxMeta(authId: string) {
    return this.repo.findBoxMetaByAccountId(Number(authId));
  }

  async evolve(authId: string, body: { id: number; cost: string }, ip?: string) {
    const accountId = Number(authId);

    // 1. 소유권 검증
    const pokemon = await this.repo.findByIdAndAccount(body.id, accountId);
    if (!pokemon) {
      throw new AppError('Pokemon not found', 404, AppErrorCode.POKEMON_NOT_FOUND);
    }

    // 2. 마스터 데이터 조회
    const masterPokemon = MasterData.getPokemon(pokemon.pokedexId);
    if (!masterPokemon || masterPokemon.evolNext.length === 0) {
      throw new AppError('Evolution not available', 400, AppErrorCode.EVOLUTION_NOT_AVAILABLE);
    }

    // 3. cost 매칭
    const costIndex = masterPokemon.evolCost.indexOf(body.cost);
    if (costIndex === -1) {
      throw new AppError('Invalid evolution cost', 400, AppErrorCode.EVOLUTION_COST_INVALID);
    }

    const newPokedexId = masterPokemon.evolNext[costIndex];

    const parts = body.cost.split('+').map((p) => p.trim());
    const itemCost = new Map<string, number>();

    let cachedGameTime: string | null | undefined;

    for (const part of parts) {
      const candyMatch = part.match(/^candy_(\d+)$/);
      const friendshipMatch = part.match(/^friendship_(\d+)$/);
      const timeMatch = part.match(/^time_(day|night|dawn|dusk)$/);
      const genderMatch = part.match(/^(male|female)$/);

      if (candyMatch) {
        const candyCount = Number(candyMatch[1]);
        const candyItemId = `${masterPokemon.type1}-candy`;
        itemCost.set(candyItemId, (itemCost.get(candyItemId) ?? 0) + candyCount);
      } else if (friendshipMatch) {
        const required = Number(friendshipMatch[1]);
        if (pokemon.friendship < required) {
          throw new AppError('Not enough friendship', 400, AppErrorCode.EVOLUTION_COST_NOT_ENOUGH);
        }
      } else if (timeMatch) {
        const requiredPeriod = timeMatch[1];
        if (cachedGameTime === undefined) {
          cachedGameTime = (await getGameTime())?.phase ?? null;
        }
        if (cachedGameTime !== requiredPeriod) {
          throw new AppError('Time condition not met', 400, AppErrorCode.EVOLUTION_COST_NOT_ENOUGH);
        }
      } else if (genderMatch) {
        const requiredGender =
          genderMatch[1] === 'male' ? PokemonGender.MALE : PokemonGender.FEMALE;
        if (pokemon.gender !== requiredGender) {
          throw new AppError(
            'Gender condition not met',
            400,
            AppErrorCode.EVOLUTION_COST_NOT_ENOUGH,
          );
        }
      } else {
        itemCost.set(part, (itemCost.get(part) ?? 0) + 1);
      }
    }

    // 5. 트랜잭션: 모든 아이템 비용 차감 + pokedexId 변경 (원자적)
    const result = await db.transaction(async (tx) => {
      for (const [itemId, requiredCount] of itemCost) {
        const [item] = await tx
          .select({ quantity: userItem.quantity })
          .from(userItem)
          .where(and(eq(userItem.accountId, accountId), eq(userItem.itemId, itemId)));

        if (!item || item.quantity < requiredCount) {
          throw new AppError(
            'Not enough evolution items',
            400,
            AppErrorCode.EVOLUTION_COST_NOT_ENOUGH,
          );
        }

        if (item.quantity - requiredCount === 0) {
          await tx
            .delete(userItem)
            .where(and(eq(userItem.accountId, accountId), eq(userItem.itemId, itemId)));
        } else {
          await tx
            .update(userItem)
            .set({ quantity: sql`${userItem.quantity} - ${requiredCount}` })
            .where(and(eq(userItem.accountId, accountId), eq(userItem.itemId, itemId)));
        }
      }

      // pokedexId 변경
      const [updated] = await tx
        .update(userPokemon)
        .set({ pokedexId: newPokedexId })
        .where(and(eq(userPokemon.id, body.id), eq(userPokemon.accountId, accountId)))
        .returning();

      await tx
        .insert(userPokedex)
        .values({ accountId, pokedexId: newPokedexId, caughtCount: 1 })
        .onConflictDoUpdate({
          target: [userPokedex.accountId, userPokedex.pokedexId],
          set: { caughtCount: sql`${userPokedex.caughtCount} + 1` },
        });

      await auditTx(tx, {
        accountId,
        action: AuditAction.POKEMON_EVOLVE,
        detail: {
          userPokemonId: body.id,
          fromPokedexId: pokemon.pokedexId,
          toPokedexId: newPokedexId,
          cost: body.cost,
        },
        ip: ip ?? null,
        source: 'api',
      });

      return updated;
    });

    return result;
  }

  async sell(authId: string, body: { ids: number[] }, ip?: string) {
    const accountId = Number(authId);
    const ids = [...new Set(body.ids)];

    const pokemons = await this.repo.findRowsByIdsAndAccount(ids, accountId);
    if (pokemons.length !== ids.length) {
      throw new AppError('Pokemon not found', 404, AppErrorCode.POKEMON_NOT_FOUND);
    }

    if (pokemons.some((p) => p.partySlot !== null)) {
      throw new AppError('Cannot sell a party pokemon', 400, AppErrorCode.POKEMON_IN_PARTY);
    }

    // 마리당 보상을 계산하면서, 클라이언트에 돌려줄 보상은 itemId 기준으로 합산한다.
    const rewardTotals = new Map<string, number>();
    const auditEntries: {
      userPokemonId: number;
      pokedexId: string;
      level: number;
      rewards: { itemId: string; quantity: number }[];
    }[] = [];

    for (const pokemon of pokemons) {
      const masterPokemon = MasterData.getPokemon(pokemon.pokedexId);
      if (!masterPokemon) {
        throw new AppError(
          'Pokemon master data not found',
          500,
          AppErrorCode.INTERNAL_SERVER_ERROR,
        );
      }

      const typeCandy = {
        itemId: `${masterPokemon.type1}-candy`,
        quantity: LEVEL_CURVE.SELL_CANDY_BY_TIER[masterPokemon.tier],
      };
      const expCandy = pickSellExpCandy(masterPokemon.tier, pokemon.level);
      const rewards = [typeCandy, expCandy];

      for (const reward of rewards) {
        rewardTotals.set(reward.itemId, (rewardTotals.get(reward.itemId) ?? 0) + reward.quantity);
      }

      auditEntries.push({
        userPokemonId: pokemon.id,
        pokedexId: pokemon.pokedexId,
        level: pokemon.level,
        rewards,
      });
    }

    const rewards = [...rewardTotals].map(([itemId, quantity]) => ({ itemId, quantity }));

    await db.transaction(async (tx) => {
      await tx
        .delete(userPokemon)
        .where(and(inArray(userPokemon.id, ids), eq(userPokemon.accountId, accountId)));

      for (const reward of rewards) {
        await tx
          .insert(userItem)
          .values({ accountId, itemId: reward.itemId, quantity: reward.quantity })
          .onConflictDoUpdate({
            target: [userItem.accountId, userItem.itemId],
            set: { quantity: sql`${userItem.quantity} + ${reward.quantity}` },
          });
      }

      for (const entry of auditEntries) {
        await auditTx(tx, {
          accountId,
          action: AuditAction.POKEMON_SELL,
          detail: entry,
          ip: ip ?? null,
          source: 'api',
        });
      }
    });

    return { rewards };
  }

  async arrange(
    authId: string,
    body: {
      changes: {
        id: number;
        boxNumber: number | null;
        gridNumber: number | null;
        partySlot: number | null;
      }[];
      boxMeta?: {
        boxNumber: number;
        wallpaper: number;
        name: string;
      }[];
      nicknames?: {
        id: number;
        nickname: string | null;
      }[];
    },
  ) {
    const accountId = Number(authId);
    const ids = body.changes.map((c) => c.id);

    const nicknameIds = (body.nicknames ?? []).map((n) => n.id).filter((id) => !ids.includes(id));
    const allIds = [...ids, ...nicknameIds];

    if (nicknameIds.length > 0) {
      const ownedNicknames = await this.repo.findByIdsAndAccount(nicknameIds, accountId);
      if (ownedNicknames.length !== nicknameIds.length) {
        throw new AppError('Pokemon not found', 404, AppErrorCode.POKEMON_NOT_FOUND);
      }
    }

    if (ids.length > 0) {
      const owned = await this.repo.findByIdsAndAccount(ids, accountId);
      if (owned.length !== ids.length) {
        throw new AppError('Pokemon not found', 404, AppErrorCode.POKEMON_NOT_FOUND);
      }

      const partyInChanges = body.changes.filter((c) => c.partySlot !== null);
      const unchangedParty = await this.repo.countPartyExcluding(accountId, ids);
      if (partyInChanges.length + unchangedParty > 6) {
        throw new AppError('Party limit exceeded', 400, AppErrorCode.PARTY_LIMIT_EXCEEDED);
      }
    }

    await db.transaction(async (tx) => {
      // 포켓몬 위치 변경
      // 1. 모든 대상을 임시로 null 처리 (unique 제약 충돌 방지)
      // 2. 최종 위치로 업데이트
      for (const change of body.changes) {
        await tx
          .update(userPokemon)
          .set({ boxNumber: null, gridNumber: null, partySlot: null })
          .where(and(eq(userPokemon.id, change.id), eq(userPokemon.accountId, accountId)));
      }
      for (const change of body.changes) {
        await tx
          .update(userPokemon)
          .set({
            boxNumber: change.boxNumber,
            gridNumber: change.gridNumber,
            partySlot: change.partySlot,
          })
          .where(and(eq(userPokemon.id, change.id), eq(userPokemon.accountId, accountId)));
      }

      // 박스 메타 upsert
      if (body.boxMeta?.length) {
        for (const meta of body.boxMeta) {
          await this.repo.upsertBoxMeta(tx, accountId, meta);
        }
      }

      // 닉네임 변경
      if (body.nicknames?.length) {
        for (const entry of body.nicknames) {
          await tx
            .update(userPokemon)
            .set({ nickname: entry.nickname })
            .where(and(eq(userPokemon.id, entry.id), eq(userPokemon.accountId, accountId)));
        }
      }
    });
  }

  async enhance(
    authId: string,
    body: { id: number; candies: { itemId: string; count: number }[] },
    ip?: string,
  ) {
    const accountId = Number(authId);

    const pokemon = await this.repo.findByIdAndAccount(body.id, accountId);
    if (!pokemon) {
      throw new AppError('Pokemon not found', 404, AppErrorCode.POKEMON_NOT_FOUND);
    }

    const masterPokemon = MasterData.getPokemon(pokemon.pokedexId);
    if (!masterPokemon) {
      throw new AppError('Pokemon master data not found', 500, AppErrorCode.INTERNAL_SERVER_ERROR);
    }
    if (pokemon.level >= POKEMON_LEVEL_MAX) {
      throw new AppError(
        'Pokemon already at max level',
        400,
        AppErrorCode.POKEMON_LEVEL_MAX_EXCEEDED,
      );
    }

    const candyMap = new Map<string, number>();
    let expGain = 0;
    for (const c of body.candies) {
      if (!isExpCandyId(c.itemId)) {
        throw new AppError('Invalid exp candy', 400, AppErrorCode.DTO_INVALID);
      }
      candyMap.set(c.itemId, (candyMap.get(c.itemId) ?? 0) + c.count);
      expGain += EXP_CANDY_VALUE[c.itemId] * c.count;
    }

    const group = masterPokemon.growthGroup;
    const capExp = totalExpForLevel(POKEMON_LEVEL_MAX, group);

    const result = await db.transaction(async (tx) => {
      for (const [itemId, required] of candyMap) {
        const [item] = await tx
          .select({ quantity: userItem.quantity })
          .from(userItem)
          .where(and(eq(userItem.accountId, accountId), eq(userItem.itemId, itemId)));

        if (!item || item.quantity < required) {
          throw new AppError('Not enough candy', 400, AppErrorCode.CANDY_NOT_ENOUGH);
        }
        if (item.quantity === required) {
          await tx
            .delete(userItem)
            .where(and(eq(userItem.accountId, accountId), eq(userItem.itemId, itemId)));
        } else {
          await tx
            .update(userItem)
            .set({ quantity: sql`${userItem.quantity} - ${required}` })
            .where(and(eq(userItem.accountId, accountId), eq(userItem.itemId, itemId)));
        }
      }

      const baseExp = Math.max(pokemon.exp, totalExpForLevel(pokemon.level, group));
      const newExp = Math.min(baseExp + expGain, capExp);
      const newLevel = levelFromExp(newExp, group);

      const [updated] = await tx
        .update(userPokemon)
        .set({ exp: newExp, level: newLevel })
        .where(and(eq(userPokemon.id, body.id), eq(userPokemon.accountId, accountId)))
        .returning({
          id: userPokemon.id,
          level: userPokemon.level,
          exp: userPokemon.exp,
        });

      await auditTx(tx, {
        accountId,
        action: AuditAction.POKEMON_ENHANCE,
        detail: {
          userPokemonId: body.id,
          expGain,
          fromLevel: pokemon.level,
          toLevel: updated.level,
          exp: updated.exp,
        },
        ip: ip ?? null,
        source: 'api',
      });

      return { updated, prevLevel: pokemon.level };
    });

    return {
      id: result.updated.id,
      level: result.updated.level,
      exp: result.updated.exp,
      expToNext: expToNextLevel(result.updated.exp, group),
      leveledUp: result.updated.level > result.prevLevel,
    };
  }

  async learnMove(authId: string, body: { id: number; move: string }, ip?: string) {
    const accountId = Number(authId);

    // 1. 소유권 검증
    const pokemon = await this.repo.findByIdAndAccount(body.id, accountId);
    if (!pokemon) {
      throw new AppError('Pokemon not found', 404, AppErrorCode.POKEMON_NOT_FOUND);
    }

    // 2. 마스터 데이터에서 skills 확인
    const masterPokemon = MasterData.getPokemon(pokemon.pokedexId);
    if (!masterPokemon || !masterPokemon.skills.includes(body.move)) {
      throw new AppError(
        'Move not learnable by this pokemon',
        400,
        AppErrorCode.MOVE_NOT_LEARNABLE,
      );
    }

    // 3. 중복 체크
    const currentSkills = (pokemon.skills as string[]) ?? [];
    if (currentSkills.includes(body.move)) {
      throw new AppError('Move already learned', 409, AppErrorCode.MOVE_ALREADY_LEARNED);
    }

    if (currentSkills.length >= 4) {
      throw new AppError('Move limit exceeded', 400, AppErrorCode.MOVE_LIMIT_EXCEEDED);
    }

    // 4. 트랜잭션: 아이템 차감 + skills push
    const result = await db.transaction(async (tx) => {
      const [item] = await tx
        .select({ quantity: userItem.quantity })
        .from(userItem)
        .where(and(eq(userItem.accountId, accountId), eq(userItem.itemId, body.move)));

      if (!item || item.quantity < 1) {
        throw new AppError('Move item not found', 400, AppErrorCode.MOVE_ITEM_NOT_FOUND);
      }

      if (item.quantity === 1) {
        await tx
          .delete(userItem)
          .where(and(eq(userItem.accountId, accountId), eq(userItem.itemId, body.move)));
      } else {
        await tx
          .update(userItem)
          .set({ quantity: sql`${userItem.quantity} - 1` })
          .where(and(eq(userItem.accountId, accountId), eq(userItem.itemId, body.move)));
      }

      const newSkills = [...currentSkills, body.move];
      const [updated] = await tx
        .update(userPokemon)
        .set({ skills: newSkills })
        .where(and(eq(userPokemon.id, body.id), eq(userPokemon.accountId, accountId)))
        .returning();

      await auditTx(tx, {
        accountId,
        action: AuditAction.POKEMON_LEARN_MOVE,
        detail: { userPokemonId: body.id, move: body.move, pokedexId: pokemon.pokedexId },
        ip: ip ?? null,
        source: 'api',
      });

      return updated;
    });

    return result;
  }
}
