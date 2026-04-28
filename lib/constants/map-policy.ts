export function shouldSyncOtherPlayers(mapId: string): boolean {
  return mapId.startsWith('p');
}
