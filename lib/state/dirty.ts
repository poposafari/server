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
