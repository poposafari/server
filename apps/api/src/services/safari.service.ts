import { Repository } from "typeorm";
import { AppDataSource } from "../data-source";
import {
  ItemType,
  OverworldType,
  PokemonGender,
  PokemonSkill,
  Rarity,
  Type,
} from "../enums";
import { UseTicketReq } from "../interfaces";
import { Bag } from "../entities/Bag";
import { BagService } from "./bag.service";

interface Overworld {
  comment: string;
  type: OverworldType;
  key: string;
  cost: number;
  x: number;
  y: number;
  spawnCount: number;
  spawn: string[];
}

interface NextEvol {
  next: string;
  cost: number | "string";
}

interface Rate {
  spawn: number;
  capture: number;
}

interface Pokemon {
  comment: string;
  nextEvol: NextEvol;
  rate: Rate;
  rank: Rarity;
  type1: Type;
  type2: Type | null;
}

interface WildPokemon {
  pokedex: string;
  gender: PokemonGender;
  shiny: boolean;
  skills: PokemonSkill | null;
  form: number;
}

export class SafariService {
  static overworlds: Record<string, Overworld> = {};
  static pokemons: Record<string, Pokemon> = {};

  private static get bagRepo(): Repository<Bag> {
    return AppDataSource.getRepository(Bag);
  }

  public static getOverworldData(key: string) {
    const found = SafariService.overworlds[key];
    return found;
  }

  public static async useTicket(
    user: number,
    data: UseTicketReq
  ): Promise<any> {
    const overworld = this.getOverworldData(data.overworld);

    if (!overworld) throw Error("Not found overworld data");

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let result: any;

    try {
      const bag = await queryRunner.manager.findOne(Bag, {
        where: { account_id: user, item: "030" },
      });

      if (!bag) {
        return "not-enough-ticket";
      }

      const newStock = bag.stock - overworld.cost;
      if (newStock < 0) {
        result = "not-enough-ticket";
      } else {
        bag.stock = newStock;
        await BagService.useItem(user, { item: "030", stock: overworld.cost });

        result = {
          item: "030",
          category: ItemType.ETC,
          stock: bag.stock,
        };

        if (overworld.type === OverworldType.SAFARI) {
          result["wilds"] = SafariService.getWildPokemons(
            SafariService.getPokemonSpawns(
              overworld.spawn,
              overworld.spawnCount
            )
          );
        }

        await queryRunner.commitTransaction();
      }
    } catch (err: any) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    return result;
  }

  public static getPokemonSpawns(spawns: string[], count: number) {
    const ret: string[] = [];
    const target: { pokedex: string; rate: number }[] = [];

    for (const pokedex of spawns) {
      const pokemon = this.pokemons[pokedex];
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
  }

  public static getWildPokemons(pokedexs: string[]): WildPokemon[] {
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
  }
}

function getRandomGender(): PokemonGender.FEMALE | PokemonGender.MALE {
  return Math.random() < 0.5 ? PokemonGender.FEMALE : PokemonGender.MALE;
}

function getShinyRandom(): boolean {
  return Math.random() < 1 / 512;
}
