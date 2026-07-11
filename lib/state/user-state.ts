// 유저 실시간 상태 — 힙(ephemeral) 스토어. 재시작 시 비는 게 정상.
// 위치는 dirty 추적으로 Postgres에 주기 write-back(position-flush).

import { UserState } from './types';

const USER_STATE_FIELDS: (keyof UserState)[] = [
  'mapId',
  'x',
  'y',
  'nickname',
  'gender',
  'costume',
  'socketId',
  'pet:pokedexId',
  'pet:isShiny',
  'createdAt',
  'lastMoveTime',
  'visitedMaps',
];

const states = new Map<string, UserState>();

/** 지난 flush 이후 실제로 변경(이동/맵/펫)된 authId. flush 대상. */
const dirty = new Set<string>();

export function markDirty(authId: string): void {
  dirty.add(authId);
}

/** 현재 dirty 목록 스냅샷을 반환하고 비운다. flush 루프가 소비. */
export function drainDirty(): string[] {
  const out = [...dirty];
  dirty.clear();
  return out;
}

export function clearDirty(authId: string): void {
  dirty.delete(authId);
}

function normalize(raw: Partial<UserState>): UserState {
  const state = {} as UserState;
  for (const k of USER_STATE_FIELDS) {
    state[k] = raw[k] ?? '';
  }
  return state;
}

export async function getUserState(authId: string): Promise<UserState | null> {
  const s = states.get(authId);
  return s ? { ...s } : null;
}

export async function setUserState(authId: string, state: UserState): Promise<void> {
  states.set(authId, normalize(state));
}

export async function deleteUserState(authId: string): Promise<void> {
  states.delete(authId);
  dirty.delete(authId);
}

export async function clearUserStateSocketId(authId: string): Promise<void> {
  const s = states.get(authId);
  if (s) s.socketId = '';
}

export async function setUserStateSocketId(authId: string, socketId: string): Promise<void> {
  const s = states.get(authId);
  if (s) s.socketId = socketId;
}

export async function setUserStateCreatedAt(authId: string, createdAt: string): Promise<void> {
  const s = states.get(authId);
  if (s) s.createdAt = createdAt;
}

export async function getAllUserStateAuthIds(): Promise<string[]> {
  return [...states.keys()];
}

export async function updateUserStatePosition(
  authId: string,
  updates: { x: string; y: string; lastMoveTime: string },
): Promise<void> {
  const s = states.get(authId);
  if (!s) return;
  s.x = updates.x;
  s.y = updates.y;
  s.lastMoveTime = updates.lastMoveTime;
  dirty.add(authId);
}

export async function updateUserStateMap(
  authId: string,
  updates: { mapId: string; x: string; y: string; lastMoveTime: string },
): Promise<void> {
  const s = states.get(authId);
  if (!s) return;
  s.mapId = updates.mapId;
  s.x = updates.x;
  s.y = updates.y;
  s.lastMoveTime = updates.lastMoveTime;
  dirty.add(authId);
}

export async function updateUserStatePet(
  authId: string,
  pet: { pokedexId: string | null; isShiny: boolean },
): Promise<void> {
  const s = states.get(authId);
  if (!s) return;
  s['pet:pokedexId'] = pet.pokedexId ?? '';
  s['pet:isShiny'] = pet.isShiny ? '1' : '0';
  dirty.add(authId);
}

/** visitedMaps 필드 갱신 (사파리 최초 진입 기록). 구 socket app.ts의 직접 hset 대체. */
export async function setUserStateVisitedMaps(authId: string, visitedMaps: string): Promise<void> {
  const s = states.get(authId);
  if (s) s.visitedMaps = visitedMaps;
}
