import { eq, and, sql } from 'drizzle-orm';
import { db } from '@poposerver/lib/db';
import { userPokemon, userItem } from '@poposerver/lib/schema';
import { MasterData } from '@poposerver/lib/utils/master-data';
import { AppError } from '@poposerver/lib/utils/error';
import { AppErrorCode } from '@poposerver/lib/types';
import { PokemonRepository } from './pokemon.repository';

export class PokemonService {
  constructor(private readonly repo: PokemonRepository) {}

  async getBox(authId: string) {
    return this.repo.findBoxByAccountId(Number(authId));
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
          throw new AppError('Evolution item not found', 400, AppErrorCode.EVOLUTION_COST_NOT_ENOUGH);
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
