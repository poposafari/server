// Lean 6 스모크 부하 드라이버 — plaza 동접 N명을 실제 프로토콜대로 올린다.
//
// 유저당 6단계: register → user/create → user/me(여기서 Redis user:state lazy-create)
//   → game/connect(SLOT 획득 + conn 토큰) → socket 핸드셰이크(auth.token) → init → move 루프
//
// 실행(보통은 run-smoke.sh가 호출):
//   API_URL=http://localhost:9000 SOCKET_URL=http://localhost:9010 \
//   N=50 DURATION_SEC=60 RUN_TAG=$(date +%H%M%S) node load-test/plaza-smoke.mjs
//
// socket.io-client는 server/node_modules에 이미 설치돼 있어 server/ 디렉토리에서 실행하면 resolve됨.

import { io } from 'socket.io-client';

const API = process.env.API_URL ?? 'http://localhost:9000';
const SOCKET = process.env.SOCKET_URL ?? 'http://localhost:9010';
const N = Number(process.env.N ?? 50);
const DURATION_SEC = Number(process.env.DURATION_SEC ?? 60);
const MOVE_INTERVAL_MS = Number(process.env.MOVE_INTERVAL_MS ?? 500);
const ARRIVAL_PER_SEC = Number(process.env.ARRIVAL_PER_SEC ?? 20); // 초당 신규 가상유저 투입
const RUN_TAG =
  (process.env.RUN_TAG ?? 't')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 6) || 't';
const PASSWORD = 'pw123456';
const DIRS = ['up', 'down', 'left', 'right'];

const m = {
  registered: 0,
  loggedIn: 0,
  created: 0,
  meOk: 0,
  connectReady: 0,
  connectSlotFull: 0,
  socketConnected: 0,
  initOk: 0,
  initError: 0,
  errors: {}, // stage -> count
  lat: { connectHttp: [], handshake: [], init: [] },
};
function err(stage, e) {
  m.errors[stage] = (m.errors[stage] ?? 0) + 1;
  if (process.env.VERBOSE) console.error(`  [${stage}]`, e?.message ?? e);
}
function pct(arr, p) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return Math.round(s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]);
}
function extractSid(res) {
  const cookies = res.headers.getSetCookie?.() ?? [];
  const sid = cookies.find((c) => c.startsWith('sid='));
  return sid ? sid.split(';')[0].slice(4) : null;
}

const sockets = [];
const timers = [];

async function ensureSession(username) {
  // register 시도 → 이미 있으면(재실행) login으로 폴백. 둘 다 sid 쿠키를 준다.
  let res = await fetch(`${API}/api/auth/register/local`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password: PASSWORD }),
  });
  let sid = res.ok ? extractSid(res) : null;
  if (sid) {
    m.registered++;
    return sid;
  }

  res = await fetch(`${API}/api/auth/login/local`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password: PASSWORD }),
  });
  sid = res.ok ? extractSid(res) : null;
  if (sid) {
    m.loggedIn++;
    return sid;
  }
  throw new Error(`auth failed (register+login) status=${res.status}`);
}

async function onboard(i) {
  const username = `l${RUN_TAG}${String(i).padStart(5, '0')}`; // 6~20자 lowercase+digit
  const nickname = `n${RUN_TAG}${i}`.slice(0, 12); // 2~12자 letters/numbers
  const cookie = (sid) => ({ cookie: `sid=${sid}` });

  let sid;
  try {
    sid = await ensureSession(username);
  } catch (e) {
    err('auth', e);
    return;
  }

  // user/create — 재실행 시 이미 있으면 비-ok일 수 있으나 진행(me가 진실의 원천)
  try {
    const res = await fetch(`${API}/api/user/create`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...cookie(sid) },
      body: JSON.stringify({
        nickname,
        gender: 'male',
        costume: { skin: 'skin_0', hair: 'hair_0_c0', outfit: 'outfit_0' },
      }),
    });
    if (res.ok) m.created++;
  } catch (e) {
    err('create', e);
  }

  // user/me — Redis user:state lazy-create. init이 이걸 요구하므로 필수.
  try {
    const res = await fetch(`${API}/api/user/me`, { headers: cookie(sid) });
    if (!res.ok) {
      err('me', new Error(`status=${res.status}`));
      return;
    }
    m.meOk++;
  } catch (e) {
    err('me', e);
    return;
  }

  // game/connect — SLOT 획득 + conn 토큰
  let token;
  try {
    const t0 = performance.now();
    const res = await fetch(`${API}/api/game/connect`, { method: 'POST', headers: cookie(sid) });
    m.lat.connectHttp.push(performance.now() - t0);
    if (!res.ok) {
      err('connect', new Error(`status=${res.status}`));
      return;
    }
    const body = await res.json();
    const data = body?.data ?? {};
    if (!data.ready) {
      m.connectSlotFull++;
      return;
    }
    token = data.token;
    m.connectReady++;
  } catch (e) {
    err('connect', e);
    return;
  }

  // socket 핸드셰이크 + init
  await new Promise((resolve) => {
    const tHandshake = performance.now();
    const socket = io(SOCKET, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
      timeout: 10000,
    });
    sockets.push(socket);
    let settled = false;
    const done = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };

    socket.on('connect', () => {
      m.socketConnected++;
      m.lat.handshake.push(performance.now() - tHandshake);
      const tInit = performance.now();
      socket.once('init_ok', () => {
        m.initOk++;
        m.lat.init.push(performance.now() - tInit);
        // move 루프 시작
        const timer = setInterval(() => {
          if (socket.connected) {
            socket.emit('move', {
              direction: DIRS[(Math.floor(performance.now()) + i) % 4],
              moveType: 'walk',
            });
          }
        }, MOVE_INTERVAL_MS);
        timers.push(timer);
        done();
      });
      socket.once('init_error', (p) => {
        m.initError++;
        err('init', new Error(p?.message ?? 'init_error'));
        done();
      });
      socket.emit('init');
    });
    socket.on('connect_error', (e) => {
      err('handshake', e);
      done();
    });
    socket.on('kicked', () => {
      err('kicked', new Error('kicked'));
    });
  });
}

function summary() {
  const heldActive = sockets.filter((s) => s.connected).length;
  console.log('\n──────── 스모크 결과 (N=' + N + ', RUN_TAG=' + RUN_TAG + ') ────────');
  console.log(
    `onboarding : register=${m.registered} login=${m.loggedIn} create=${m.created} me=${m.meOk}`,
  );
  console.log(`connect    : ready=${m.connectReady} slotFull=${m.connectSlotFull}`);
  console.log(
    `socket     : connected=${m.socketConnected} initOk=${m.initOk} initError=${m.initError}`,
  );
  console.log(`현재 유지중 : ${heldActive} 소켓 (목표 동접 ${N})`);
  console.log(
    `latency(ms): connectHttp p50=${pct(m.lat.connectHttp, 50)} p95=${pct(m.lat.connectHttp, 95)} max=${pct(m.lat.connectHttp, 100)}`,
  );
  console.log(
    `             handshake   p50=${pct(m.lat.handshake, 50)} p95=${pct(m.lat.handshake, 95)} max=${pct(m.lat.handshake, 100)}`,
  );
  console.log(
    `             init        p50=${pct(m.lat.init, 50)} p95=${pct(m.lat.init, 95)} max=${pct(m.lat.init, 100)}`,
  );
  const ek = Object.keys(m.errors);
  console.log(
    `errors     : ${ek.length ? ek.map((k) => `${k}=${m.errors[k]}`).join(' ') : '없음'}`,
  );
  const okRate = N ? Math.round((m.initOk / N) * 100) : 0;
  console.log(`성공률     : ${m.initOk}/${N} = ${okRate}% 가 plaza 진입(init_ok)`);
  console.log('───────────────────────────────────────────────\n');
}

function teardown() {
  for (const t of timers) clearInterval(t);
  for (const s of sockets) {
    try {
      s.disconnect();
    } catch {}
  }
}

let interrupted = false;
process.on('SIGINT', () => {
  interrupted = true;
  console.log('\n(SIGINT) 정리 중…');
  summary();
  teardown();
  process.exit(130);
});

async function main() {
  console.log(
    `[smoke] target api=${API} socket=${SOCKET} | N=${N} duration=${DURATION_SEC}s arrival=${ARRIVAL_PER_SEC}/s`,
  );
  const gap = 1000 / Math.max(1, ARRIVAL_PER_SEC);
  const tasks = [];
  for (let i = 0; i < N; i++) {
    tasks.push(onboard(i));
    if (gap >= 1) await new Promise((r) => setTimeout(r, gap)); // 점진 투입(thundering herd 완화)
    if (interrupted) break;
  }
  await Promise.allSettled(tasks);
  console.log(
    `[smoke] 전원 투입 완료. ${DURATION_SEC}s 동안 유지 — 지금 docker stats를 관찰하세요.`,
  );
  await new Promise((r) => setTimeout(r, DURATION_SEC * 1000));
  summary();
  teardown();
  // disconnect 핸들러가 Redis→PG write-back + 슬롯 해제할 시간을 잠깐 준다
  await new Promise((r) => setTimeout(r, 2000));
  process.exit(0);
}

main().catch((e) => {
  console.error('[smoke] fatal', e);
  teardown();
  process.exit(1);
});
