import { markDirty } from './dirty';

export interface Position {
  mapId: string;
  x: number;
  y: number;
}

const positions = new Map<string, Position>();

export function getPosition(authId: string): Position | null {
  const p = positions.get(authId);
  return p ? { ...p } : null;
}

export function initPosition(authId: string, position: Position): void {
  positions.set(authId, { ...position });
}

export function setPosition(authId: string, position: Position): void {
  if (!positions.has(authId)) return;
  positions.set(authId, { ...position });
  markDirty(authId);
}

export function movePosition(authId: string, dx: number, dy: number): Position | null {
  const p = positions.get(authId);
  if (!p) return null;
  p.x += dx;
  p.y += dy;
  markDirty(authId);
  return { ...p };
}

export function deletePosition(authId: string): void {
  positions.delete(authId);
}
