import { MapWildState } from './map.type';
import { PokemonGender } from './pokemon.type';

export interface UserSession {
  mapId: string;
  socketId: string;
  x: number;
  y: number;
  createAt: Date;
}

export interface WildPokemon {
  id: string;
  pokedex: string;
  gender: PokemonGender;
  isShiny: boolean;
  mapId: string;
  x: number;
  y: number;
  spawnedAt: number;
  despawnAt: number;
  state: MapWildState;
  destX?: number;
  destY?: number;
  arriveAt?: number;
}

export interface WildItem {
  id: string;
  itemId: string;
  amount: number;
  state: MapWildState;
  mapId: string;
  x: number;
  y: number;
  spawnedAt: number;
}
