import { RoomMemberState, UserState } from './types';
import { getUserState } from './user-state';

const rooms = new Map<string, Set<string>>();

export async function addUserToRoom(mapId: string, userId: string): Promise<void> {
  let set = rooms.get(mapId);
  if (!set) {
    set = new Set();
    rooms.set(mapId, set);
  }
  set.add(userId);
}

export async function removeUserFromRoom(mapId: string, userId: string): Promise<void> {
  const set = rooms.get(mapId);
  if (!set) return;
  set.delete(userId);
  if (set.size === 0) rooms.delete(mapId);
}

export function extractPetState(state: UserState): { pokedexId: string; isShiny: boolean } | null {
  const pokedexId = state['pet:pokedexId'];
  if (!pokedexId) return null;
  return { pokedexId, isShiny: state['pet:isShiny'] === '1' };
}

export async function getRoomMemberStates(mapId: string): Promise<RoomMemberState[]> {
  const set = rooms.get(mapId);
  if (!set || set.size === 0) return [];

  const out: RoomMemberState[] = [];
  for (const userId of set) {
    const state = await getUserState(userId);
    if (state) out.push({ userId, ...state });
  }
  return out;
}
