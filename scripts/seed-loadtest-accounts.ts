/**
 * RIDE-300 부하테스트용 더미 계정 시드.
 *
 * 실행 (미니PC — prod env):
 *   dotenv -e docker/prod/.env.prod -- ts-node -r tsconfig-paths/register scripts/seed-loadtest-accounts.ts
 *   COUNT=300 MAP=p001 dotenv -e ... -- ts-node ... scripts/seed-loadtest-accounts.ts
 *   DROP=1 dotenv -e ... -- ts-node ... scripts/seed-loadtest-accounts.ts     # 정리
 *
 * 컨테이너 안에서 돌릴 때(prod 이미지엔 ts-node가 없다)는 호스트에서 DB_HOST=localhost 로 직접 붙는다.
 *
 * 정책
 *   - provider='local', providerId = `${PREFIX}0001` … 로그인 스키마(소문자+숫자, 6~20자)를 만족한다.
 *   - 비밀번호는 전원 동일하고 **bcrypt 해시를 1회만 계산해 재사용**한다.
 *     (salt가 해시에 박혀 있어 compare가 그대로 통과한다. 300회 해싱하면 Celeron에서 수십 초를 버린다.)
 *   - id는 명시하지 않는다 — SERIAL 시퀀스 드리프트를 만들지 않기 위해서.
 *   - lastMapId 는 기본 p001. 사파리 맵(s___)은 shouldSyncOtherPlayers=false 라 브로드캐스트가 0이 되어
 *     부하테스트가 통째로 무의미해진다.
 *   - 좌표는 유저마다 흩뿌린다(같은 타일에 겹쳐도 서버는 검증하지 않지만, 분포가 현실과 가깝다).
 *   - 멱등: 이미 있는 providerId 는 건너뛴다. 다시 돌려도 중복 생성되지 않는다.
 */
import bcrypt from 'bcrypt';
import { and, eq, like, inArray } from 'drizzle-orm';
import { db } from '../lib/db';
import { account, user, userCostume, userItem } from '../lib/schema';
import { PokemonGender } from '../lib/types';

const PREFIX = process.env.PREFIX ?? 'loadtest';
const COUNT = Number(process.env.COUNT ?? 300);
const PASSWORD = process.env.PASSWORD ?? 'loadtest1';
const MAP = process.env.MAP ?? 'p001';
const BASE_X = Number(process.env.BASE_X ?? 40);
const BASE_Y = Number(process.env.BASE_Y ?? 20);
const SPAN = Number(process.env.SPAN ?? 20);
const DROP = process.env.DROP === '1';
const SALT_ROUNDS = 10;

const pad = (n: number) => String(n).padStart(4, '0');
const providerIdOf = (i: number) => `${PREFIX}${pad(i)}`;
const nicknameOf = (i: number) => `lt${pad(i)}`; // user.nickname unique, 14자 제한

async function drop() {
  const rows = await db
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.provider, 'local'), like(account.providerId, `${PREFIX}%`)));

  if (rows.length === 0) {
    console.log(`[drop] 대상 없음 (prefix=${PREFIX})`);
    return;
  }
  const ids = rows.map((r) => r.id);
  // user/user_costume/user_item 은 account FK on delete cascade
  await db.delete(account).where(inArray(account.id, ids));
  console.log(`[drop] ${ids.length}개 계정 삭제 (prefix=${PREFIX})`);
}

async function seed() {
  console.log(`[1/3] 기존 계정 조회 (prefix=${PREFIX})`);
  const existing = await db
    .select({ id: account.id, providerId: account.providerId })
    .from(account)
    .where(and(eq(account.provider, 'local'), like(account.providerId, `${PREFIX}%`)));
  const have = new Set(existing.map((r) => r.providerId));

  const todo: number[] = [];
  for (let i = 1; i <= COUNT; i++) if (!have.has(providerIdOf(i))) todo.push(i);

  if (todo.length === 0) {
    console.log(`[2/3] 이미 ${COUNT}개가 모두 존재한다. 할 일 없음.`);
  } else {
    console.log(`[2/3] bcrypt 해시 1회 계산 후 ${todo.length}개 생성`);
    const hash = await bcrypt.hash(PASSWORD, SALT_ROUNDS);

    for (const i of todo) {
      const providerId = providerIdOf(i);
      const gender = i % 2 === 0 ? PokemonGender.MALE : PokemonGender.FEMALE;
      const g = gender === PokemonGender.MALE ? 'm' : 'f';
      const x = BASE_X + (i % SPAN);
      const y = BASE_Y + (Math.floor(i / SPAN) % SPAN);

      await db.transaction(async (tx) => {
        const [acc] = await tx
          .insert(account)
          .values({ provider: 'local', providerId, password: hash })
          .returning({ id: account.id });

        await tx.insert(user).values({
          accountId: acc.id,
          nickname: nicknameOf(i),
          gender,
          hasStarter: true,
          lastMapId: MAP,
          lastX: x,
          lastY: y,
        });

        await tx.insert(userCostume).values(
          ['skin_0', `${g}_hair_0_c0`, `${g}_outfit_0`].map((costumeId) => ({
            accountId: acc.id,
            costumeId,
            isEquipped: true,
          })),
        );

        await tx.insert(userItem).values({
          accountId: acc.id,
          itemId: 'safari-ball',
          quantity: 30,
        });
      });

      if (i % 50 === 0) console.log(`      ... ${i}/${COUNT}`);
    }
  }

  // 이미 있던 계정도 위치/맵을 이번 회차 기준으로 맞춘다(직전 회차에서 이동해 있었을 수 있다).
  console.log(`[3/3] 전 계정 위치를 ${MAP} 로 리셋`);
  const all = await db
    .select({ id: account.id, providerId: account.providerId })
    .from(account)
    .where(and(eq(account.provider, 'local'), like(account.providerId, `${PREFIX}%`)));

  for (const row of all) {
    const i = Number(row.providerId.slice(PREFIX.length));
    if (!Number.isFinite(i)) continue;
    await db
      .update(user)
      .set({
        lastMapId: MAP,
        lastX: BASE_X + (i % SPAN),
        lastY: BASE_Y + (Math.floor(i / SPAN) % SPAN),
      })
      .where(eq(user.accountId, row.id));
  }

  console.log(
    `\n완료. 계정 ${all.length}개 — username ${providerIdOf(1)} ~ ${providerIdOf(COUNT)}, password="${PASSWORD}", map=${MAP}`,
  );
}

async function main() {
  if (DROP) await drop();
  else await seed();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
