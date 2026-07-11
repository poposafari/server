import { GameTimeState, SafariWild, WeatherState, WildDespawnReason } from './types';
import { logger } from '../utils/logger';

export interface Broadcaster {
  kick(authId: string, targetSocketId?: string): void;
  broadcastMaintenance(): void;
  broadcastGameTime(state: GameTimeState): void;
  broadcastWeather(state: WeatherState): void;
  emitWildSpawn(authId: string, mapId: string, wild: SafariWild): void;
  emitWildDespawn(authId: string, mapId: string, wildUid: string, reason: WildDespawnReason): void;
}

let broadcaster: Broadcaster | null = null;

export function registerBroadcaster(b: Broadcaster): void {
  broadcaster = b;
}

function withBroadcaster(fn: (b: Broadcaster) => void): void {
  if (!broadcaster) {
    logger.warn('[Broadcaster] not registered yet; message dropped');
    return;
  }
  fn(broadcaster);
}

// ── publish* seam (async 시그니처 보존) ──

export async function publishSocketKick(authId: string, targetSocketId?: string): Promise<void> {
  withBroadcaster((b) => b.kick(authId, targetSocketId));
}

export async function publishSocketMaintenance(): Promise<void> {
  withBroadcaster((b) => b.broadcastMaintenance());
}

export async function publishGameTime(state: GameTimeState): Promise<void> {
  withBroadcaster((b) => b.broadcastGameTime(state));
}

export async function publishMapWeather(state: WeatherState): Promise<void> {
  withBroadcaster((b) => b.broadcastWeather(state));
}

export async function publishWildSpawn(msg: {
  authId: string;
  mapId: string;
  wild: SafariWild;
}): Promise<void> {
  withBroadcaster((b) => b.emitWildSpawn(msg.authId, msg.mapId, msg.wild));
}

export async function publishWildDespawn(msg: {
  authId: string;
  mapId: string;
  wildUid: string;
  reason: WildDespawnReason;
}): Promise<void> {
  withBroadcaster((b) => b.emitWildDespawn(msg.authId, msg.mapId, msg.wildUid, msg.reason));
}
