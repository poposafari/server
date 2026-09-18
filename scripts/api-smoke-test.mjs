/**
 * 개발 서버 REST API 스모크 테스트.
 *
 *   pnpm run db:dev && pnpm run dev
 *   node scripts/api-smoke-test.mjs
 *
 * 매 실행마다 신규 계정 2개를 만들어 전 도메인 엔드포인트를 호출하고,
 * 응답 상태 + DB 반영 결과를 함께 검증한다.
 * 소켓 플레이가 필요한 흐름(이동, 실시간 브로드캐스트)과 OAuth 콜백은 제외한다.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(
  readFileSync(resolve(ROOT, '.env.dev'), 'utf8')
    .split('\n')
    .filter((l) => l.trim() && !l.trim().startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const BASE = `http://localhost:${env.API_PORT}/api`;
const PG_CONTAINER = process.env.PG_CONTAINER ?? 'poposerver_postgres';
const DB = [
  'exec',
  '-i',
  PG_CONTAINER,
  'psql',
  '-U',
  env.DB_USERNAME,
  '-d',
  env.DB_DATABASE,
  '-tAc',
];

function sql(q) {
  return execFileSync('docker', [...DB, q], { encoding: 'utf8' }).trim();
}

let cookie = '';
const results = [];
let step = 0;

function record(name, ok, detail) {
  step++;
  results.push({ step, name, ok, detail });
  const tag = ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
  console.log(`${String(step).padStart(3)}. ${tag}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function req(method, path, body, opts = {}) {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (cookie && !opts.noCookie) headers.cookie = cookie;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual',
  });
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const [kv] = c.split(';');
    if (kv.startsWith('sid=')) cookie = kv;
  }
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, body: json, headers: res.headers };
}

function check(name, cond, detail) {
  record(name, !!cond, detail);
  return !!cond;
}

async function expectStatus(name, method, path, body, want, opts) {
  const r = await req(method, path, body, opts);
  const ok = Array.isArray(want) ? want.includes(r.status) : r.status === want;
  record(
    `${name} [${method} ${path}]`,
    ok,
    `status=${r.status}${ok ? '' : ` want=${want} body=${JSON.stringify(r.body).slice(0, 200)}`}`,
  );
  return r;
}

const qty = (acc, item) =>
  sql(
    `select coalesce((select quantity from user_item where account_id=${acc} and item_id='${item}'),0)`,
  );
const money = (acc) => sql(`select money from "user" where account_id=${acc}`);

async function signup(suffix = '') {
  const uname = 'test' + suffix + Date.now().toString().slice(-7);
  const pw = 'testpass123';
  cookie = '';
  const r = await req('POST', '/accounts', { username: uname, password: pw });
  const id = sql(`select id from account where provider_id='${uname}' and provider='local'`);
  return { uname, pw, id, status: r.status };
}

const pw = 'testpass123';
let uname, accountId;

// ───────────────────────── AUTH ─────────────────────────
console.log('\n--- auth ---');
await expectStatus(
  '회원가입 validation 실패',
  'POST',
  '/accounts',
  { username: 'AB', password: 'x' },
  400,
);
{
  const a = await signup();
  uname = a.uname;
  accountId = a.id;
  record(
    '회원가입 [POST /accounts]',
    a.status === 201,
    `status=${a.status} account_id=${accountId}`,
  );
  check('DB: account 행 생성', !!accountId);
  check(
    'DB: 세션 행 생성',
    sql(`select count(*) from session where account_id=${accountId}`) === '1',
  );
}
await expectStatus('중복 회원가입', 'POST', '/accounts', { username: uname, password: pw }, 409);
await expectStatus('세션 확인', 'GET', '/sessions/current', undefined, 200);
await expectStatus('쿠키 없이 세션 확인', 'GET', '/sessions/current', undefined, 401, {
  noCookie: true,
});
await expectStatus('로그아웃', 'POST', '/auth/logout', undefined, 200);
await expectStatus('로그아웃 후 세션 확인', 'GET', '/sessions/current', undefined, 401);
await expectStatus(
  '잘못된 비밀번호 로그인',
  'POST',
  '/sessions',
  { username: uname, password: 'wrongpass1' },
  [400, 401],
);
await expectStatus('로그인', 'POST', '/sessions', { username: uname, password: pw }, 201);
await expectStatus('로그인 후 세션 확인', 'GET', '/sessions/current', undefined, 200);
{
  const r = await req('GET', '/auth/oauth/kakao/authorize');
  record(
    '없는 OAuth provider [GET /auth/oauth/kakao/authorize]',
    r.status === 404,
    `status=${r.status}`,
  );
  const g = await req('GET', '/auth/oauth/google/authorize');
  record(
    'OAuth authorize 리다이렉트 [GET /auth/oauth/google/authorize]',
    g.status === 302,
    `status=${g.status} → ${(g.headers.get('location') || '').slice(0, 45)}…`,
  );
}

// ───────────────────────── USER ─────────────────────────
console.log('\n--- user ---');
await expectStatus('유저 생성 전 조회', 'GET', '/users/me', undefined, 404);
const costume = { skin: 'skin_0', hair: 'hair_0_c0', outfit: 'outfit_0' };
await expectStatus(
  '닉네임 validation 실패',
  'POST',
  '/users',
  { nickname: 'a', gender: 'male', costume },
  400,
);
await expectStatus(
  '예약어 닉네임 거부',
  'POST',
  '/users',
  { nickname: 'admin1', gender: 'male', costume },
  400,
);
await expectStatus(
  '코스튬 포맷 validation',
  'POST',
  '/users',
  {
    nickname: 'Tester1',
    gender: 'male',
    costume: { skin: 'x', hair: 'hair_0_c0', outfit: 'outfit_0' },
  },
  400,
);
const nickname = 'T' + Date.now().toString().slice(-8);
await expectStatus('유저 생성', 'POST', '/users', { nickname, gender: 'male', costume }, 201);
check(
  'DB: user 행 생성',
  sql(`select nickname from "user" where account_id=${accountId}`) === nickname,
);
check(
  'DB: 코스튬 3개 저장',
  sql(`select count(*) from user_costume where account_id=${accountId}`) === '3',
  `costumes=${sql(`select string_agg(costume_id,',') from user_costume where account_id=${accountId}`)}`,
);
check('DB: 시작 아이템 safari-ball 1개', qty(accountId, 'safari-ball') === '1');
await expectStatus(
  '중복 유저 생성',
  'POST',
  '/users',
  { nickname: nickname + 'x', gender: 'male', costume },
  409,
);
{
  const r = await expectStatus('내 정보 조회', 'GET', '/users/me', undefined, 200);
  const d = r.body?.data;
  check(
    '내 정보 응답 형태',
    d && d.profile?.nickname === nickname && Array.isArray(d.party) && !!d.safariTicket,
    `money=${d?.profile?.money} lastMapId=${d?.profile?.lastMapId} ticket=${d?.safariTicket?.available}`,
  );
}

console.log('\n--- 조회계 ---');
for (const [name, path] of [
  ['코스튬 목록', '/users/me/costumes'],
  ['도감', '/users/me/pokedex'],
  ['방문 맵', '/users/me/visited-maps'],
  ['가방', '/users/me/items'],
  ['박스 포켓몬', '/users/me/pokemons'],
  ['박스 메타', '/users/me/boxes'],
])
  await expectStatus(name, 'GET', path, undefined, 200);

// ─────────────────── 사파리 티켓 ───────────────────
console.log('\n--- 사파리 티켓 ---');
{
  const r = await expectStatus('티켓 상태', 'GET', '/users/me/safari-ticket', undefined, 200);
  check(
    '신규 유저 티켓 1개 선지급',
    r.body?.data?.available === 1,
    `available=${r.body?.data?.available}`,
  );
  const c = await expectStatus(
    '티켓 claim',
    'POST',
    '/users/me/safari-ticket/claim',
    undefined,
    200,
  );
  check('claim 1개', c.body?.data?.claimed === 1, `claimed=${c.body?.data?.claimed}`);
  check('DB: 티켓 아이템 1개', qty(accountId, 'safari-zone-ticket') === '1');
}
await expectStatus('소진 후 재claim 거부', 'POST', '/users/me/safari-ticket/claim', undefined, 400);
sql(
  `update "user" set safari_ticket_regen_at = now() - interval '17 hours' where account_id=${accountId}`,
);
{
  const r = await expectStatus(
    '17시간 경과 후 claim',
    'POST',
    '/users/me/safari-ticket/claim',
    undefined,
    200,
  );
  check('claim 2개', r.body?.data?.claimed === 2, `claimed=${r.body?.data?.claimed}`);
  check(
    'DB: 티켓 누적 3개',
    qty(accountId, 'safari-zone-ticket') === '3',
    `qty=${qty(accountId, 'safari-zone-ticket')}`,
  );
}

// ─────────────────── 아이템 ───────────────────
console.log('\n--- 아이템 ---');
sql(`update "user" set money=100000 where account_id=${accountId}`);
{
  await expectStatus(
    '구매(safari-ball x10 @200)',
    'POST',
    '/users/me/items/safari-ball/buy',
    { quantity: 10 },
    200,
  );
  check('DB: 소지금 100000→98000', money(accountId) === '98000', `money=${money(accountId)}`);
  check(
    'DB: safari-ball 1→11',
    qty(accountId, 'safari-ball') === '11',
    `qty=${qty(accountId, 'safari-ball')}`,
  );
}
await expectStatus(
  '구매 불가 아이템',
  'POST',
  '/users/me/items/experience-candy-l/buy',
  { quantity: 1 },
  400,
);
await expectStatus(
  '없는 아이템 구매',
  'POST',
  '/users/me/items/no-such-item/buy',
  { quantity: 1 },
  404,
);
await expectStatus(
  '구매 수량 validation(0)',
  'POST',
  '/users/me/items/safari-ball/buy',
  { quantity: 0 },
  400,
);
await expectStatus(
  '소지금 초과 구매',
  'POST',
  '/users/me/items/safari-ball/buy',
  { quantity: 9999 },
  400,
);
{
  await expectStatus(
    '판매(safari-ball x4 @10)',
    'POST',
    '/users/me/items/safari-ball/sell',
    { quantity: 4 },
    200,
  );
  check('DB: 소지금 98000→98040', money(accountId) === '98040', `money=${money(accountId)}`);
  check(
    'DB: safari-ball 11→7',
    qty(accountId, 'safari-ball') === '7',
    `qty=${qty(accountId, 'safari-ball')}`,
  );
}
await expectStatus(
  '보유량 초과 판매',
  'POST',
  '/users/me/items/safari-ball/sell',
  { quantity: 999 },
  400,
);
await expectStatus(
  '판매 불가 아이템',
  'POST',
  '/users/me/items/safari-zone-ticket/sell',
  { quantity: 1 },
  400,
);
await expectStatus(
  '비-key 아이템 즐겨찾기 거부',
  'PATCH',
  '/users/me/items/safari-ball',
  { register: true },
  400,
);
await expectStatus(
  '미보유 key 아이템 즐겨찾기 거부',
  'PATCH',
  '/users/me/items/bicycle',
  { register: true },
  400,
);
{
  await expectStatus(
    '자전거 구매(15000)',
    'POST',
    '/users/me/items/bicycle/buy',
    { quantity: 1 },
    200,
  );
  check('DB: 소지금 98040→83040', money(accountId) === '83040', `money=${money(accountId)}`);
  await expectStatus(
    '자전거 중복 구매 거부',
    'POST',
    '/users/me/items/bicycle/buy',
    { quantity: 1 },
    400,
  );
  await expectStatus('즐겨찾기 등록', 'PATCH', '/users/me/items/bicycle', { register: true }, 200);
  check(
    'DB: register=true',
    sql(`select register from user_item where account_id=${accountId} and item_id='bicycle'`) ===
      't',
  );
  await expectStatus('즐겨찾기 해제', 'PATCH', '/users/me/items/bicycle', { register: false }, 200);
  check(
    'DB: register=false',
    sql(`select register from user_item where account_id=${accountId} and item_id='bicycle'`) ===
      'f',
  );
}
await expectStatus(
  'register 타입 validation',
  'PATCH',
  '/users/me/items/bicycle',
  { register: 'yes' },
  400,
);

// ─────────────────── 화석 ───────────────────
console.log('\n--- 화석 ---');
await expectStatus('레시피 범위 초과(16)', 'POST', '/users/me/fossils/16/restore', undefined, 400);
await expectStatus('숫자 아닌 fossilId', 'POST', '/users/me/fossils/abc/restore', undefined, 400);
await expectStatus('재료 없이 복원', 'POST', '/users/me/fossils/1/restore', undefined, 400);
sql(
  `insert into user_item(account_id,item_id,quantity) values(${accountId},'helix-fossil',1) on conflict (account_id,item_id) do update set quantity=1`,
);
let pokemonId;
{
  const r = await expectStatus(
    '화석 복원(1 → 0138)',
    'POST',
    '/users/me/fossils/1/restore',
    undefined,
    201,
  );
  pokemonId = r.body?.data?.pokemon?.id;
  const row = sql(
    `select pokedex_id||'|'||level||'|'||coalesce(party_slot::text,'null') from user_pokemon where id=${pokemonId}`,
  );
  check('DB: 포켓몬 생성(0138 / L20 / 파티0번)', row === '0138|20|0', `row=${row} id=${pokemonId}`);
  check('DB: 화석 재료 소모', qty(accountId, 'helix-fossil') === '0');
  check(
    'DB: 도감 등록',
    sql(
      `select caught_count from user_pokedex where account_id=${accountId} and pokedex_id='0138'`,
    ) === '1',
  );
}

// ─────────────────── 포켓몬 ───────────────────
console.log('\n--- 포켓몬 강화/승급/기술 ---');
await expectStatus('숫자 아닌 pokemonId', 'POST', '/users/me/pokemons/abc/upgrade', undefined, 400);
await expectStatus(
  '남의 포켓몬 접근',
  'POST',
  '/users/me/pokemons/99999999/upgrade',
  undefined,
  404,
);
sql(
  `insert into user_item(account_id,item_id,quantity) values(${accountId},'experience-candy-xl',40) on conflict (account_id,item_id) do update set quantity=40`,
);
{
  const r = await expectStatus(
    '경험사탕 강화(xl x2)',
    'POST',
    `/users/me/pokemons/${pokemonId}/enhance`,
    { candies: [{ itemId: 'experience-candy-xl', count: 2 }] },
    200,
  );
  const row = sql(`select level||'|'||exp from user_pokemon where id=${pokemonId}`);
  check(
    'DB: exp 8000+60000 → L40',
    row === '40|68000',
    `row=${row} resp=${JSON.stringify(r.body?.data)}`,
  );
  check('DB: 사탕 40→38', qty(accountId, 'experience-candy-xl') === '38');
}
await expectStatus(
  '경험사탕 아닌 아이템',
  'POST',
  `/users/me/pokemons/${pokemonId}/enhance`,
  { candies: [{ itemId: 'potion', count: 1 }] },
  400,
);
await expectStatus(
  '보유량 초과 사탕',
  'POST',
  `/users/me/pokemons/${pokemonId}/enhance`,
  { candies: [{ itemId: 'experience-candy-xl', count: 999 }] },
  400,
);
await expectStatus(
  '레벨 100까지 강화',
  'POST',
  `/users/me/pokemons/${pokemonId}/enhance`,
  { candies: [{ itemId: 'experience-candy-xl', count: 35 }] },
  200,
);
check('DB: L100 도달', sql(`select level from user_pokemon where id=${pokemonId}`) === '100');
await expectStatus(
  '만렙 추가 강화 거부',
  'POST',
  `/users/me/pokemons/${pokemonId}/enhance`,
  { candies: [{ itemId: 'experience-candy-xl', count: 1 }] },
  400,
);
await expectStatus(
  '캔디 부족 승급',
  'POST',
  `/users/me/pokemons/${pokemonId}/upgrade`,
  undefined,
  400,
);
sql(
  `insert into user_item(account_id,item_id,quantity) values(${accountId},'rock-candy',200) on conflict (account_id,item_id) do update set quantity=200`,
);
{
  await expectStatus(
    '승급(rare→super-rare)',
    'POST',
    `/users/me/pokemons/${pokemonId}/upgrade`,
    undefined,
    200,
  );
  check(
    'DB: tier=super-rare',
    sql(`select tier from user_pokemon where id=${pokemonId}`) === 'super-rare',
  );
  check('DB: rock-candy 200→100', qty(accountId, 'rock-candy') === '100');
}
await expectStatus(
  '못 배우는 기술',
  'POST',
  `/users/me/pokemons/${pokemonId}/moves`,
  { move: 'move_fly' },
  400,
);
await expectStatus(
  '기술머신 미보유',
  'POST',
  `/users/me/pokemons/${pokemonId}/moves`,
  { move: 'move_surf' },
  400,
);
sql(
  `insert into user_item(account_id,item_id,quantity) values(${accountId},'move_surf',1) on conflict (account_id,item_id) do update set quantity=1`,
);
{
  await expectStatus(
    '기술 배우기(move_surf)',
    'POST',
    `/users/me/pokemons/${pokemonId}/moves`,
    { move: 'move_surf' },
    201,
  );
  check(
    'DB: skills 저장',
    sql(`select skills::text from user_pokemon where id=${pokemonId}`).includes('move_surf'),
  );
  check('DB: 기술머신 소모', qty(accountId, 'move_surf') === '0');
}
sql(
  `insert into user_item(account_id,item_id,quantity) values(${accountId},'move_surf',1) on conflict (account_id,item_id) do update set quantity=1`,
);
await expectStatus(
  '이미 배운 기술',
  'POST',
  `/users/me/pokemons/${pokemonId}/moves`,
  { move: 'move_surf' },
  409,
);

console.log('\n--- 진화 ---');
{
  const before = qty(accountId, 'rock-candy');
  await expectStatus(
    '잘못된 진화 비용',
    'POST',
    `/users/me/pokemons/${pokemonId}/evolve`,
    { cost: 'candy_999' },
    400,
  );
  await expectStatus(
    '진화(0138→0139, candy_40)',
    'POST',
    `/users/me/pokemons/${pokemonId}/evolve`,
    { cost: 'candy_40' },
    200,
  );
  check(
    'DB: pokedex_id 0139',
    sql(`select pokedex_id from user_pokemon where id=${pokemonId}`) === '0139',
  );
  check(
    'DB: rock-candy 40 소모',
    Number(qty(accountId, 'rock-candy')) === Number(before) - 40,
    `${before} → ${qty(accountId, 'rock-candy')}`,
  );
  check(
    'DB: 진화체 도감 등록',
    sql(
      `select caught_count from user_pokedex where account_id=${accountId} and pokedex_id='0139'`,
    ) === '1',
  );
}

console.log('\n--- 지닌 물건 ---');
{
  await expectStatus(
    '지닌 물건 지정',
    'PUT',
    `/users/me/pokemons/${pokemonId}/held-item`,
    { heldItem: 'safari-ball' },
    200,
  );
  check(
    'DB: held_item_id 저장',
    sql(`select held_item_id from user_pokemon where id=${pokemonId}`) === 'safari-ball',
  );
  await expectStatus(
    '지닌 물건 회수',
    'DELETE',
    `/users/me/pokemons/${pokemonId}/held-item`,
    undefined,
    200,
  );
  check(
    'DB: held_item_id 해제',
    sql(`select coalesce(held_item_id,'null') from user_pokemon where id=${pokemonId}`) === 'null',
  );
}
await expectStatus(
  '숫자 아닌 id로 held-item',
  'PUT',
  '/users/me/pokemons/abc/held-item',
  { heldItem: 'safari-ball' },
  400,
);

console.log('\n--- 박스 정리 ---');
{
  await expectStatus(
    '박스 이동 + 닉네임 + 박스메타',
    'PATCH',
    '/users/me/pokemons',
    {
      changes: [{ id: pokemonId, boxNumber: 1, gridNumber: 0, partySlot: null }],
      boxMeta: [{ boxNumber: 1, wallpaper: 3, name: '테스트박스' }],
      nicknames: [{ id: pokemonId, nickname: '암순이' }],
    },
    200,
  );
  const row = sql(
    `select coalesce(box_number::text,'n')||'|'||coalesce(grid_number::text,'n')||'|'||coalesce(party_slot::text,'n')||'|'||coalesce(nickname,'n') from user_pokemon where id=${pokemonId}`,
  );
  check('DB: 배치/닉네임 반영', row === '1|0|n|암순이', `row=${row}`);
  check(
    'DB: 박스 메타 저장',
    sql(
      `select wallpaper||'|'||name from user_box_meta where account_id=${accountId} and box_number=1`,
    ) === '3|테스트박스',
  );
}
await expectStatus(
  '남의 포켓몬 정리',
  'PATCH',
  '/users/me/pokemons',
  { changes: [{ id: 99999999, boxNumber: 1, gridNumber: 1, partySlot: null }] },
  404,
);
await expectStatus(
  '박스 번호 범위 validation',
  'PATCH',
  '/users/me/pokemons',
  { changes: [{ id: pokemonId, boxNumber: 9999, gridNumber: 0, partySlot: null }] },
  400,
);

// ─────────────────── 게임 ───────────────────
console.log('\n--- 게임 ---');
await expectStatus('온라인 수', 'GET', '/game/online-count', undefined, 200);
{
  const r = await expectStatus(
    '게임 커넥션 토큰 발급',
    'POST',
    '/game/connections',
    undefined,
    200,
  );
  check(
    '커넥션 토큰 응답',
    r.body?.data?.ready === true && !!r.body?.data?.token,
    `data=${JSON.stringify(r.body?.data).slice(0, 70)}`,
  );
}

// ─────────────────── 사파리 ───────────────────
console.log('\n--- 사파리 (스타터존 s000) ---');
await expectStatus(
  '잘못된 mapId 형식',
  'POST',
  '/safari/enter',
  { mapId: 'x1', needEntry: false },
  400,
);
await expectStatus(
  '없는 사파리 맵',
  'POST',
  '/safari/enter',
  { mapId: 's999', needEntry: false },
  404,
);
let wildUid;
{
  const r = await expectStatus(
    's000 입장',
    'POST',
    '/safari/enter',
    { mapId: 's000', needEntry: false },
    200,
  );
  const md = r.body?.data?.mapData;
  wildUid = md?.wilds?.[0]?.uid;
  check(
    '입장 응답에 wilds/items',
    Array.isArray(md?.wilds) && Array.isArray(md?.items),
    `wilds=${md?.wilds?.length} items=${md?.items?.length}`,
  );
}
await expectStatus('uuid 아닌 wild uid', 'POST', '/safari/wilds/not-a-uuid/catch', undefined, 400);
if (wildUid) {
  const r = await expectStatus(
    '스타터 포획(확정)',
    'POST',
    `/safari/wilds/${wildUid}/catch`,
    undefined,
    200,
  );
  const caught = r.body?.data?.pokemon?.id;
  check(
    '포획 결과 caught',
    r.body?.data?.result === 'caught' && !!caught,
    `result=${r.body?.data?.result}`,
  );
  if (caught) {
    check(
      'DB: 포획 포켓몬 저장',
      sql(`select count(*) from user_pokemon where id=${caught} and account_id=${accountId}`) ===
        '1',
    );
    check(
      'DB: has_starter false 전환',
      sql(`select has_starter from "user" where account_id=${accountId}`) === 'f',
    );
    check(
      'DB: 스타터 후 p001로 이동',
      sql(`select last_map_id from "user" where account_id=${accountId}`) === 'p001',
    );
  }
}
await expectStatus(
  '스타터 소진 후 s000 재입장 거부',
  'POST',
  '/safari/enter',
  { mapId: 's000', needEntry: false },
  400,
);

console.log('\n--- 사파리 (일반존 s001) ---');
let itemUid2, wildUid2;
{
  const ticketBefore = qty(accountId, 'safari-zone-ticket');
  const r = await expectStatus(
    's001 입장(티켓 소모)',
    'POST',
    '/safari/enter',
    { mapId: 's001', needEntry: true },
    200,
  );
  check(
    'DB: 티켓 1장 소모',
    Number(qty(accountId, 'safari-zone-ticket')) === Number(ticketBefore) - 1,
    `${ticketBefore} → ${qty(accountId, 'safari-zone-ticket')}`,
  );
  const md = r.body?.data?.mapData;
  itemUid2 = md?.items?.find((i) => !i.picked)?.uid;
  wildUid2 = md?.wilds?.[0]?.uid;
  check(
    '입장 응답 형태(entry/wilds)',
    !!r.body?.data?.entry && Array.isArray(md?.wilds),
    `entry=${JSON.stringify(r.body?.data?.entry)} wilds=${md?.wilds?.length} items=${md?.items?.length}`,
  );
}
if (itemUid2) {
  const before = Number(
    sql(`select coalesce(sum(quantity),0) from user_item where account_id=${accountId}`),
  );
  const r = await expectStatus(
    '사파리 아이템 줍기',
    'POST',
    `/safari/items/${itemUid2}/pick`,
    undefined,
    200,
  );
  const after = Number(
    sql(`select coalesce(sum(quantity),0) from user_item where account_id=${accountId}`),
  );
  check(
    'DB: 아이템 +1 지급',
    after === before + 1,
    `총수량 ${before} → ${after}, got=${JSON.stringify(r.body?.data)}`,
  );
  await expectStatus(
    '이미 주운 아이템 재획득',
    'POST',
    `/safari/items/${itemUid2}/pick`,
    undefined,
    409,
  );
} else {
  record('사파리 아이템 줍기', false, 's001에 필드 아이템 없음 — 스킵');
}
await expectStatus(
  '없는 아이템 uid 줍기',
  'POST',
  '/safari/items/00000000-0000-4000-8000-000000000000/pick',
  undefined,
  404,
);
if (wildUid2) {
  const b = await req('POST', `/safari/wilds/${wildUid2}/bait`);
  record(
    '먹이 주기(bait) [POST /safari/wilds/:uid/bait]',
    b.status === 200 && typeof b.body?.data?.result === 'string',
    `status=${b.status} result=${b.body?.data?.result ?? ''}`,
  );
  const rk = await req('POST', `/safari/wilds/${wildUid2}/rock`);
  record(
    '돌 던지기(rock) [POST /safari/wilds/:uid/rock]',
    [200, 404, 409].includes(rk.status),
    `status=${rk.status} result=${rk.body?.data?.result ?? ''}`,
  );
  const ballBefore = qty(accountId, 'safari-ball');
  const c = await req('POST', `/safari/wilds/${wildUid2}/catch`);
  record(
    '일반존 포획 시도 [POST /safari/wilds/:uid/catch]',
    [200, 404, 409].includes(c.status),
    `status=${c.status} result=${c.body?.data?.result ?? ''}`,
  );
  if (c.status === 200) {
    check(
      'DB: 사파리볼 1개 소모',
      Number(qty(accountId, 'safari-ball')) === Number(ballBefore) - 1,
      `${ballBefore} → ${qty(accountId, 'safari-ball')}`,
    );
  }
}
{
  const r = await expectStatus('사파리 퇴장', 'POST', '/safari/exit', undefined, 200);
  check(
    '퇴장 후 p001 복귀',
    r.body?.data?.mapId === 'p001',
    `resp=${JSON.stringify(r.body?.data)}`,
  );
}
await expectStatus(
  '사파리 밖에서 줍기 거부',
  'POST',
  '/safari/items/00000000-0000-4000-8000-000000000000/pick',
  undefined,
  400,
);

// ─────────────────── 포켓몬 판매 ───────────────────
console.log('\n--- 포켓몬 판매 ---');
{
  const partyId = sql(
    `select coalesce(min(id),0) from user_pokemon where account_id=${accountId} and party_slot is not null`,
  );
  await expectStatus(
    '파티 포켓몬 판매 거부',
    'POST',
    '/users/me/pokemons/sell',
    { ids: [Number(partyId)] },
    [400, 404],
  );
}
{
  const r = await expectStatus(
    '박스 포켓몬 판매',
    'POST',
    '/users/me/pokemons/sell',
    { ids: [pokemonId] },
    200,
  );
  check('DB: 포켓몬 삭제', sql(`select count(*) from user_pokemon where id=${pokemonId}`) === '0');
  const rewards = r.body?.data?.rewards ?? [];
  const ok =
    rewards.length > 0 && rewards.every((x) => Number(qty(accountId, x.itemId)) >= x.quantity);
  check('DB: 판매 보상 지급', ok, `rewards=${JSON.stringify(rewards)}`);
}
await expectStatus('빈 ids validation', 'POST', '/users/me/pokemons/sell', { ids: [] }, 400);

// ─────────────────── 내부 API ───────────────────
console.log('\n--- 내부 ---');
{
  const res = await fetch(`${BASE}/__internal/maintenance/broadcast`, { method: 'POST' });
  record(
    '토큰 없이 호출 차단 [POST /api/__internal/maintenance/broadcast]',
    [401, 503].includes(res.status),
    `status=${res.status} (503 = INTERNAL_TOKEN 미설정)`,
  );
}

// ─────────────────── 세션 / 계정 삭제 (별도 계정) ───────────────────
console.log('\n--- 세션 무효화 / 계정 삭제 ---');
{
  const b = await signup('d');
  await req('POST', '/users', {
    nickname: 'D' + Date.now().toString().slice(-8),
    gender: 'female',
    costume,
  });
  await expectStatus('다른 기기 세션 무효화', 'POST', '/auth/invalidate-session', undefined, 200);
  check('DB: 세션 행 삭제', sql(`select count(*) from session where account_id=${b.id}`) === '0');
  await expectStatus('무효화 후 요청 차단', 'GET', '/users/me', undefined, 401);
  await expectStatus('재로그인', 'POST', '/sessions', { username: b.uname, password: b.pw }, 201);
  await expectStatus('계정 삭제(soft delete)', 'DELETE', '/accounts/me', undefined, 204);
  check(
    'DB: account.deleted_at 기록',
    sql(`select (deleted_at is not null)::text from account where id=${b.id}`) === 'true',
  );
  check(
    'DB: 삭제 후 세션 제거',
    sql(`select count(*) from session where account_id=${b.id}`) === '0',
  );
  await expectStatus(
    '삭제된 계정 로그인 차단',
    'POST',
    '/sessions',
    { username: b.uname, password: b.pw },
    [400, 401, 404, 409],
  );
}

// ─────────────────── 요약 ───────────────────
const failed = results.filter((r) => !r.ok);
console.log(
  `\n=== 총 ${results.length}건 / 통과 ${results.length - failed.length} / 실패 ${failed.length} ===`,
);
if (failed.length) {
  console.log('\n실패 목록:');
  for (const f of failed) console.log(`  ${f.step}. ${f.name} — ${f.detail}`);
}
console.log(`\n테스트 계정: ${uname} (account_id=${accountId})`);
