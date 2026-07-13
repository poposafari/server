import { db } from '@poposerver/lib/db';
import { user, userCostume, userPokemon, userItem, userPokedex } from '@poposerver/lib/schema';
import { eq, and, or, isNotNull, like, sql } from 'drizzle-orm';

export class UserRepository {
  async findByAccountId(accountId: number) {
    const [result] = await db
      .select({ accountId: user.accountId })
      .from(user)
      .where(eq(user.accountId, accountId))
      .limit(1);
    return result ?? null;
  }

  async findByNickname(nickname: string) {
    const [result] = await db
      .select({ accountId: user.accountId })
      .from(user)
      .where(eq(user.nickname, nickname))
      .limit(1);
    return result ?? null;
  }

  async createWithCostumes(
    accountId: number,
    nickname: string,
    gender: number,
    lastMapId: string,
    lastX: number,
    lastY: number,
    costumeIds: string[],
  ) {
    await db.transaction(async (tx) => {
      await tx.insert(user).values({
        accountId,
        nickname,
        gender,
        lastMapId,
        lastX,
        lastY,
      });

      await tx.insert(userCostume).values(
        costumeIds.map((costumeId) => ({
          accountId,
          costumeId,
          isEquipped: true,
        })),
      );

      await tx.insert(userItem).values({
        accountId,
        itemId: 'safari-ball',
        quantity: 1,
      });
    });
  }

  async findGameDataByAccountId(accountId: number) {
    // 1. 프로필 조회
    const [profile] = await db
      .select({
        nickname: user.nickname,
        gender: user.gender,
        money: user.money,
        playtime: user.playtime,
        hasStarter: user.hasStarter,
        lastMapId: user.lastMapId,
        lastX: user.lastX,
        lastY: user.lastY,
      })
      .from(user)
      .where(eq(user.accountId, accountId))
      .limit(1);

    if (!profile) return null;

    // 2. 착용 코스튬 조회
    const equippedCostumes = await db
      .select({
        costumeId: userCostume.costumeId,
      })
      .from(userCostume)
      .where(and(eq(userCostume.accountId, accountId), eq(userCostume.isEquipped, true)));

    // 3. 파티 포켓몬 조회
    const party = await db
      .select({
        id: userPokemon.id,
        pokedexId: userPokemon.pokedexId,
        level: userPokemon.level,
        exp: userPokemon.exp,
        friendship: userPokemon.friendship,
        gender: userPokemon.gender,
        isShiny: userPokemon.isShiny,
        nickname: userPokemon.nickname,
        tier: userPokemon.tier,
        abilityId: userPokemon.abilityId,
        natureId: userPokemon.natureId,
        skills: userPokemon.skills,
        heldItemId: userPokemon.heldItemId,
        partySlot: userPokemon.partySlot,
        ballId: userPokemon.ballId,
        caughtLocation: userPokemon.caughtLocation,
        caughtAt: userPokemon.caughtAt,
      })
      .from(userPokemon)
      .where(and(eq(userPokemon.accountId, accountId), isNotNull(userPokemon.partySlot)))
      .orderBy(userPokemon.partySlot);

    // 4. 등록된 아이템 조회
    const itemSlots = await db
      .select({
        itemId: userItem.itemId,
        quantity: userItem.quantity,
        register: userItem.register,
      })
      .from(userItem)
      .where(and(eq(userItem.accountId, accountId), eq(userItem.register, true)));

    const essentialItems = await db
      .select({
        itemId: userItem.itemId,
        quantity: userItem.quantity,
        register: userItem.register,
      })
      .from(userItem)
      .where(
        and(
          eq(userItem.accountId, accountId),
          or(
            eq(userItem.itemId, 'safari-ball'),
            eq(userItem.itemId, 'safari-zone-ticket'),
            like(userItem.itemId, '%-candy'),
          ),
        ),
      );

    const pokedex = await db
      .select({
        pokedexId: userPokedex.pokedexId,
        caughtCount: userPokedex.caughtCount,
      })
      .from(userPokedex)
      .where(eq(userPokedex.accountId, accountId));

    const [boxCountRow] = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(userPokemon)
      .where(and(eq(userPokemon.accountId, accountId), isNotNull(userPokemon.boxNumber)));
    const pokemonBoxCount = boxCountRow?.count ?? 0;

    return {
      profile,
      equippedCostumes,
      party,
      itemSlots,
      essentialItems,
      pokedex,
      pokemonBoxCount,
    };
  }
}
