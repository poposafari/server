import { eq, and, sql } from 'drizzle-orm';
import { db } from '@poposerver/lib/db';
import { userPokemon, userItem } from '@poposerver/lib/schema';
import { MasterData } from '@poposerver/lib/utils/master-data';
import { AppError } from '@poposerver/lib/utils/error';
import { AppErrorCode, PokemonTier } from '@poposerver/lib/types';
import { updateUserStateParty } from '@poposerver/lib/redis';
import { PokemonRepository } from './pokemon.repository';

const TIER_BASE_REWARD: Record<PokemonTier, number> = {
  common: 1,
  rare: 3,
  epic: 6,
  legendary: 10,
  mythical: 10,
};

function getLevelBonus(level: number): number {
  if (level <= 20) return 0;
  if (level <= 40) return 1;
  if (level <= 60) return 2;
  if (level <= 80) return 4;
  return 7;
}

function calcSellReward(level: number, tier: PokemonTier): number {
  return TIER_BASE_REWARD[tier] + getLevelBonus(level);
}

export class PokemonService {
  constructor(private readonly repo: PokemonRepository) {}

  async getBox(authId: string) {
    return this.repo.findBoxByAccountId(Number(authId));
  }

  async getBoxMeta(authId: string) {
    return this.repo.findBoxMetaByAccountId(Number(authId));
  }

  async evolve(authId: string, body: { id: number; cost: string }) {
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

    // 4. friendship 차단
    if (/^friendship_\d+$/.test(body.cost)) {
      throw new AppError(
        'Friendship evolution not yet available',
        400,
        AppErrorCode.EVOLUTION_NOT_AVAILABLE,
      );
    }

    // 5. 트랜잭션: 아이템 차감 + pokedexId 변경
    const result = await db.transaction(async (tx) => {
      const candyMatch = body.cost.match(/^candy_(\d+)$/);

      if (candyMatch) {
        // candy_XX 패턴
        const candyCount = Number(candyMatch[1]);
        const candyItemId = `${masterPokemon.type1}-candy`;

        const [item] = await tx
          .select({ quantity: userItem.quantity })
          .from(userItem)
          .where(and(eq(userItem.accountId, accountId), eq(userItem.itemId, candyItemId)));

        if (!item || item.quantity < candyCount) {
          throw new AppError('Not enough candy', 400, AppErrorCode.EVOLUTION_COST_NOT_ENOUGH);
        }

        if (item.quantity - candyCount === 0) {
          await tx
            .delete(userItem)
            .where(and(eq(userItem.accountId, accountId), eq(userItem.itemId, candyItemId)));
        } else {
          await tx
            .update(userItem)
            .set({ quantity: sql`${userItem.quantity} - ${candyCount}` })
            .where(and(eq(userItem.accountId, accountId), eq(userItem.itemId, candyItemId)));
        }
      } else {
        // 진화석 등 일반 아이템
        const [item] = await tx
          .select({ quantity: userItem.quantity })
          .from(userItem)
          .where(and(eq(userItem.accountId, accountId), eq(userItem.itemId, body.cost)));

        if (!item || item.quantity < 1) {
          throw new AppError(
            'Evolution item not found',
            400,
            AppErrorCode.EVOLUTION_COST_NOT_ENOUGH,
          );
        }

        if (item.quantity === 1) {
          await tx
            .delete(userItem)
            .where(and(eq(userItem.accountId, accountId), eq(userItem.itemId, body.cost)));
        } else {
          await tx
            .update(userItem)
            .set({ quantity: sql`${userItem.quantity} - 1` })
            .where(and(eq(userItem.accountId, accountId), eq(userItem.itemId, body.cost)));
        }
      }

      // pokedexId 변경
      const [updated] = await tx
        .update(userPokemon)
        .set({ pokedexId: newPokedexId })
        .where(and(eq(userPokemon.id, body.id), eq(userPokemon.accountId, accountId)))
        .returning();

      return updated;
    });

    return result;
  }

  async sell(authId: string, body: { id: number }) {
    const accountId = Number(authId);

    const pokemon = await this.repo.findByIdAndAccount(body.id, accountId);
    if (!pokemon) {
      throw new AppError('Pokemon not found', 404, AppErrorCode.POKEMON_NOT_FOUND);
    }

    if (pokemon.partySlot !== null) {
      throw new AppError('Cannot sell a party pokemon', 400, AppErrorCode.POKEMON_IN_PARTY);
    }

    const masterPokemon = MasterData.getPokemon(pokemon.pokedexId);
    if (!masterPokemon) {
      throw new AppError('Pokemon master data not found', 500, AppErrorCode.INTERNAL_SERVER_ERROR);
    }

    const candyItemId = `${masterPokemon.type1}-candy`;
    const reward = calcSellReward(pokemon.level, masterPokemon.tier);

    await db.transaction(async (tx) => {
      await tx
        .delete(userPokemon)
        .where(and(eq(userPokemon.id, body.id), eq(userPokemon.accountId, accountId)));

      await tx
        .insert(userItem)
        .values({ accountId, itemId: candyItemId, quantity: reward })
        .onConflictDoUpdate({
          target: [userItem.accountId, userItem.itemId],
          set: { quantity: sql`${userItem.quantity} + ${reward}` },
        });
    });

    return { candyId: candyItemId, quantity: reward };
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

    // Redis party 동기화: DB의 최종 파티 상태를 Redis에 반영하여 Flush 덮어쓰기 방지
    if (ids.length > 0) {
      const currentParty = await this.repo.findPartyByAccountId(accountId);
      await updateUserStateParty(
        authId,
        currentParty.map((p) => ({ id: p.id })),
      );
    }
  }

  async learnMove(authId: string, body: { id: number; move: string }) {
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

      return updated;
    });

    return result;
  }
}
