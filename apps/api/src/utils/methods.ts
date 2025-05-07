import path from "path";
import "reflect-metadata";
import * as fs from "fs";
import { redis } from "../data-source";
import { ItemData, PokemonData, SpawnableItemTable } from "../store";
import { createAccessToken, createRefreshToken } from "./jwt";
import {
  Backgrounds,
  GameLogicErrorCode,
  GameLogicRes,
  GroundItem,
  IngameAvatar,
  IngameGender,
  MAX_BOX_SIZE,
  PokemonGender,
  SpawnableItem,
  WildPokemon,
} from "./type";

export const gameSuccess = <T>(data: T): GameLogicRes<T> => ({
  success: true,
  data: data,
});

export const gameFail = (reason: GameLogicErrorCode): GameLogicRes<null> => ({
  success: false,
  reason: reason,
});

export const createTokens = (user: number) => {
  const accessToken = createAccessToken({
    id: user,
  });

  const refreshToken = createRefreshToken({
    id: user,
  });

  redis.set(`refresh:${user}`, refreshToken, {
    EX: 60 * 60 * 24 * 7,
  });

  return accessToken;
};

export const getAvatarEnum = (value: string): IngameAvatar => {
  const found = Object.values(IngameAvatar).find((v) => v === value);
  if (!found) throw new Error("Invalid avatar value");
  return found as IngameAvatar;
};

export const getGenderEnum = (value: string): IngameGender => {
  const found = Object.values(IngameGender).find((v) => v === value);
  if (!found) throw new Error("Invalid gender value");
  return found as IngameGender;
};

export const setDefaultBoxes = (): Backgrounds[] => {
  let ret: Backgrounds[] = [];

  for (let i = 0; i < MAX_BOX_SIZE; i++) {
    ret.push(Backgrounds.ZERO);
  }

  return ret;
};

export const getRandomGender = (): PokemonGender.FEMALE | PokemonGender.MALE => {
  return Math.random() < 0.5 ? PokemonGender.FEMALE : PokemonGender.MALE;
};

export const getShinyRandom = (): boolean => {
  return Math.random() < 1 / 512;
};

export const getWildSpawnTable = (spawns: string[], count: number) => {
  const ret: string[] = [];
  const target: { pokedex: string; rate: number }[] = [];

  for (const pokedex of spawns) {
    const pokemon = PokemonData[pokedex];
    if (pokemon) {
      const rate = pokemon.rate.spawn ?? 0;
      if (rate > 0) {
        target.push({ pokedex, rate });
      }
    }
  }

  const total = target.reduce((sum, pokemon) => sum + pokemon.rate, 0);
  if (total <= 0) return [];

  for (let i = 0; i < count; i++) {
    const random = Math.random() * total;
    let acc = 0;

    for (const pokemon of target) {
      acc += pokemon.rate;
      if (random < acc) {
        ret.push(pokemon.pokedex);
        break;
      }
    }
  }

  return ret;
};

export const getSpawnableItemTable = (): SpawnableItem[] => {
  const result: SpawnableItem[] = [];

  for (const key in ItemData) {
    const item = ItemData[key];
    if (item.spawnable) {
      result.push({
        item: key,
        rate: item.rate,
        maxground: item.maxground,
      });
    }
  }

  return result;
};

export const getGroundItems = (count: number): GroundItem[] => {
  const ret: GroundItem[] = [];
  const totalRate = SpawnableItemTable.reduce((sum, item) => sum + item.rate, 0);

  for (let i = 0; i < count; i++) {
    const rand = Math.floor(Math.random() * totalRate);
    let acc = 0;

    for (const item of SpawnableItemTable) {
      acc += item.rate;
      if (rand <= acc) {
        const stock = Math.floor(Math.random() * item.maxground) + 1;
        ret.push({ item: item.item, stock });
        break;
      }
    }
  }

  return ret;
};

export const getWildPokemons = (pokedexs: string[]): WildPokemon[] => {
  const ret: WildPokemon[] = [];

  for (const pokedex of pokedexs) {
    ret.push({
      pokedex: pokedex,
      gender: getRandomGender(),
      shiny: getShinyRandom(),
      skills: null,
      form: 0,
    });
  }

  return ret;
};

export const readJson = (file: string) => {
  const name = "../../" + file + ".json";
  const filePath = path.resolve(__dirname, name);
  const rawData = fs.readFileSync(filePath, "utf-8");

  return JSON.parse(rawData);
};
