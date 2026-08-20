import { AuditAction, AuditSource } from '../types/audit.type';
import type { SafariItem, SafariWild } from '../state/types';
import { auditAsync } from './audit';

export type WildSpawnOrigin = 'first_entry' | 'top_up';

/**
 * 야생 스폰을 배치 단위 1행으로 기록한다.
 * 개체별 행을 만들면 10초 top-up 주기 × 접속자 수만큼 audit_log가 불어나므로,
 * 한 배치를 detail.wilds 배열에 담고 분석은 jsonb_array_elements로 푼다.
 */
export function auditWildSpawn(params: {
  authId: string;
  mapId: string;
  wilds: SafariWild[];
  origin: WildSpawnOrigin;
  source: AuditSource;
  ip?: string | null;
}): void {
  if (params.wilds.length === 0) return;

  void auditAsync({
    accountId: Number(params.authId),
    action: AuditAction.POKEMON_SPAWN,
    detail: {
      mapId: params.mapId,
      origin: params.origin,
      count: params.wilds.length,
      wilds: params.wilds.map((w) => ({
        uid: w.uid,
        pokedexId: w.pokedexId,
        level: w.level,
        gender: w.gender,
        isShiny: w.isShiny,
        // 디스폰 예정 시각(epoch ms). null이면 TTL 없음(shiny/s000) → 만료로 사라지지 않는다.
        expiresAt: w.expiresAt ?? null,
        ttlMs: w.expiresAt ? w.expiresAt - Date.now() : null,
      })),
    },
    ip: params.ip ?? null,
    source: params.source,
  });
}

/** 땅에 떨어진 아이템 스폰(버킷 생성 시 1회) 기록. */
export function auditSafariItemSpawn(params: {
  authId: string;
  mapId: string;
  items: SafariItem[];
  source: AuditSource;
  ip?: string | null;
}): void {
  if (params.items.length === 0) return;

  void auditAsync({
    accountId: Number(params.authId),
    action: AuditAction.SAFARI_ITEM_SPAWN,
    detail: {
      mapId: params.mapId,
      count: params.items.length,
      items: params.items.map((i) => ({ uid: i.uid, itemId: i.itemId })),
    },
    ip: params.ip ?? null,
    source: params.source,
  });
}
