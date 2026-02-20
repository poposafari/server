export interface AllowedSpawnPosition {
  mapId: string;
  x: number;
  y: number;
}

export const ALLOWED_CHANGE_MAP_POSITIONS: AllowedSpawnPosition[] = [
  { mapId: 'p001', x: 21, y: 17 },
  { mapId: 'p001', x: 25, y: 26 },
  { mapId: 'p001', x: 31, y: 26 },
  { mapId: 'p001', x: 37, y: 25 },
  { mapId: 'p001', x: 38, y: 25 },
  { mapId: 'p001', x: 49, y: 26 },
  { mapId: 'p001', x: 49, y: 33 },
  { mapId: 'p001', x: 55, y: 33 },
  { mapId: 'p001', x: 38, y: 42 },
  { mapId: 'p001', x: 32, y: 41 },
  { mapId: 'p001', x: 26, y: 41 },
  { mapId: 'p001', x: 44, y: 51 },
  { mapId: 'p001', x: 38, y: 51 },
  { mapId: 'p001', x: 26, y: 51 },
  { mapId: 'p002', x: 32, y: 4 },
  { mapId: 'p002', x: 16, y: 21 },
  { mapId: 'p003', x: 27, y: 4 },
  { mapId: 'p004', x: 7, y: 11 },
  { mapId: 'p005', x: 7, y: 13 },
  { mapId: 'p006', x: 9, y: 20 },
  { mapId: 'p007', x: 9, y: 15 },
  { mapId: 'p007', x: 12, y: 4 },
  { mapId: 'p008', x: 13, y: 4 },
  { mapId: 'p009', x: 8, y: 12 },
  { mapId: 'p010', x: 7, y: 12 },
  { mapId: 'p011', x: 8, y: 19 },
  { mapId: 'p011', x: 3, y: 4 },
  { mapId: 'p011', x: 13, y: 4 },
  { mapId: 'p012', x: 4, y: 4 },
  { mapId: 'p012', x: 12, y: 4 },
  { mapId: 'p013', x: 10, y: 29 },
  { mapId: 'p013', x: 3, y: 4 },
  { mapId: 'p013', x: 18, y: 4 },
  { mapId: 'p014', x: 5, y: 4 },
  { mapId: 'p014', x: 16, y: 4 },
  { mapId: 'p015', x: 8, y: 17 },
  { mapId: 'p015', x: 10, y: 10 },
  { mapId: 'p016', x: 2, y: 10 },
  { mapId: 'p016', x: 10, y: 10 },
  { mapId: 'p017', x: 2, y: 10 },
  { mapId: 'p019', x: 1, y: 19 },
  { mapId: 'p020', x: 8, y: 18 },
  { mapId: 'p020', x: 9, y: 4 },
  { mapId: 'p021', x: 13, y: 3 },
  { mapId: 'p022', x: 9, y: 17 },
  { mapId: 'p022', x: 3, y: 4 },
  { mapId: 'p023', x: 15, y: 4 },
];

export function isValidChangeMapTarget(mapId: string, x: number, y: number): boolean {
  return ALLOWED_CHANGE_MAP_POSITIONS.some((p) => p.mapId === mapId && p.x === x && p.y === y);
}
