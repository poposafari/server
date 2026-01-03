export type MapType = "plaza" | "safari";

export interface MapWildSpawnTime {
  dawn: string[];
  day: string[];
  dusk: string[];
  night: string[];
}

export interface MapWildSpawn {
  max: number;
  sunny: MapWildSpawnTime;
  rainy: MapWildSpawnTime;
  stormy: MapWildSpawnTime;
  snowy: MapWildSpawnTime;
  windy: MapWildSpawnTime;
}

export interface MapGroundItemSpawn {
  max: number;
  spawn: string[];
}
