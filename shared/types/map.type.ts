export type MapType = 'plaza' | 'safari';

export enum MapWildState {
  IDLE = 'IDLE',
  BATTLE = 'BATTLE',
  DEAD = 'DEAD',
  MOVING = 'MOVING',
}

export interface MapData {
  id: string;
  comment: string;
  cost: number;
  itemMax: number;
  itemSpawn: string[];
  type: MapType;
  wildMax: number;
  wildSunnyDawn: string[];
  wildSunnyDay: string[];
  wildSunnyDusk: string[];
  wildSunnyNight: string[];
  wildRainyDawn: string[];
  wildRainyDay: string[];
  wildRainyDusk: string[];
  wildRainyNight: string[];
  wildStormyDawn: string[];
  wildStormyDay: string[];
  wildStormyDusk: string[];
  wildStormyNight: string[];
  wildSnowyDawn: string[];
  wildSnowyDay: string[];
  wildSnowyDusk: string[];
  wildSnowyNight: string[];
  wildWindyDawn: string[];
  wildWindyDay: string[];
  wildWindyDusk: string[];
  wildWindyNight: string[];
}
