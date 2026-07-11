import crypto from 'crypto';
import { MasterData } from '@poposerver/lib/utils/master-data';
import {
  getGameTime,
  addWild,
  listWildIds,
  setSafariItems,
  getSafariItems,
  SafariItem,
} from '@poposerver/lib/state';
import { generateWildBatch, randomWildTtlSec } from '@poposerver/lib/utils/wild-roll';
import { randomInt, pickWeightedMany } from '@poposerver/lib/utils/rng';
import { TimeOfDay, Weather, S000_MAP_ID } from '@poposerver/lib/types';

/**
 * (authId, mapId) 사파리 버킷이 없으면 max까지 야생 + 아이템을 생성한다. 이미 있으면 no-op.
 *
 * 버킷 생성의 **유일한 지점**. REST enter()의 첫 진입 경로와 소켓 init/change_map 조인이
 * 모두 이 함수를 공유한다 → door/로그인/티켓/재연결 어느 경로로 사파리 룸에 들어오든
 * 조인 시점에 버킷 존재가 보장되고, 핸드셰이크가 정확한 스냅샷을 내려줄 수 있다.
 *
 * 판별은 wild 인덱스·items 존재 여부(구 enter()의 isFirstEntry와 동일)이므로,
 * disconnect로 버킷이 유지된 재진입에서는 새로 생성하지 않고 기존 개체를 그대로 둔다.
 *
 * @returns 새로 생성했으면 true, 이미 존재해 skip했으면 false.
 */
export async function ensureSafariBucket(authId: string, mapId: string): Promise<boolean> {
  if (!mapId.startsWith('s')) return false;

  const existingWildIds = await listWildIds(authId, mapId);
  const existingItems = await getSafariItems(authId, mapId);
  const isFirstEntry = existingWildIds.length === 0 && existingItems === null;
  if (!isFirstEntry) return false;

  const targetMap = MasterData.getMap(mapId);
  if (!targetMap || targetMap.type !== 'safari') return false;

  const gameTime = await getGameTime();
  const timeOfDay = (gameTime?.phase ?? TimeOfDay.DAY) as TimeOfDay;
  const weather: Weather = Weather.SUNNY; // TODO: 날씨 시스템 구현 후 교체

  // 정책: 최초 진입 시 항상 max까지 스폰 (min은 고려하지 않음).
  const wilds = await generateWildBatch(
    Number(authId),
    mapId,
    targetMap.wild.max,
    timeOfDay,
    weather,
  );
  const isS000 = mapId === S000_MAP_ID;
  for (const w of wilds) {
    // S000/shiny는 무TTL(null), 그 외는 랜덤 TTL.
    const ttlSec = isS000 || w.isShiny ? null : randomWildTtlSec();
    w.expiresAt = await addWild(authId, mapId, w, ttlSec);
  }

  // 아이템 생성
  const itemPool = targetMap.item.spawn ?? [];
  const itemCount = itemPool.length > 0 ? randomInt(targetMap.item.min, targetMap.item.max) : 0;
  const selectedItemIds = pickWeightedMany(
    itemPool.map((e) => e.id),
    itemPool.map((e) => e.weight),
    itemCount,
  );
  const items: SafariItem[] = selectedItemIds.map((itemId) => ({
    uid: crypto.randomUUID(),
    itemId,
    picked: false,
  }));
  await setSafariItems(authId, mapId, items);

  return true;
}
