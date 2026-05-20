/**
 * user_pokemon.exp 컬럼을 현재 level에 대응하는 누적 EXP로 backfill.
 *
 * 실행:
 *   - dev: dotenv -e .env.dev -- ts-node scripts/backfill-pokemon-exp.ts
 *   - prod: dotenv -e docker/prod/.env.prod -- ts-node scripts/backfill-pokemon-exp.ts
 *
 * 안전 정책:
 *   - exp != 0 인 row는 건너뜀(이미 채워진 데이터 보호)
 *   - 마스터 데이터가 없거나 growth_group 누락이면 fallback(medium_fast)
 *   - 1000행 단위로 트랜잭션 분할
 */
import { eq, and } from 'drizzle-orm';
import { db } from '../lib/db';
import { userPokemon } from '../lib/schema';
import { MasterData } from '../lib/utils/master-data';
import { totalExpForLevel } from '../lib/utils/exp-curve';
import type { GrowthGroup } from '../lib/types';

const FALLBACK_GROUP: GrowthGroup = 'medium_fast';
const BATCH = 1000;

async function main() {
  console.log('[1/3] MasterData 로드');
  await MasterData.load('backfill-pokemon-exp');

  console.log('[2/3] user_pokemon 전체 조회 (exp=0인 row만)');
  const rows = await db
    .select({
      id: userPokemon.id,
      pokedexId: userPokemon.pokedexId,
      level: userPokemon.level,
      exp: userPokemon.exp,
    })
    .from(userPokemon)
    .where(eq(userPokemon.exp, 0));
  console.log(`  대상 ${rows.length}행`);

  if (rows.length === 0) {
    console.log('  변경사항 없음 — 종료');
    process.exit(0);
  }

  console.log('[3/3] backfill 적용');
  let processed = 0;
  let fallback = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    await db.transaction(async (tx) => {
      for (const row of slice) {
        const master = MasterData.getPokemon(String(row.pokedexId));
        const group = (master?.growthGroup as GrowthGroup) ?? FALLBACK_GROUP;
        if (!master || !master.growthGroup) fallback++;
        const exp = totalExpForLevel(row.level, group);
        await tx
          .update(userPokemon)
          .set({ exp })
          .where(and(eq(userPokemon.id, row.id), eq(userPokemon.exp, 0)));
      }
    });
    processed += slice.length;
    console.log(`  ${processed}/${rows.length}`);
  }

  console.log(`완료. 처리=${processed}, fallback=${fallback}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('실패:', err);
  process.exit(1);
});
