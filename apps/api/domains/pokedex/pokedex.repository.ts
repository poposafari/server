import { db } from '@poposerver/lib/db';
import { userPokedex } from '@poposerver/lib/schema';
import { eq } from 'drizzle-orm';

export class PokedexRepository {
  async findAllByAccountId(accountId: number) {
    return db
      .select({
        pokedexId: userPokedex.pokedexId,
        caughtCount: userPokedex.caughtCount,
        registeredAt: userPokedex.registeredAt,
      })
      .from(userPokedex)
      .where(eq(userPokedex.accountId, accountId))
      .orderBy(userPokedex.pokedexId);
  }
}
