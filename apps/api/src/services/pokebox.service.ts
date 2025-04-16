import { Repository } from "typeorm";
import { Ingame } from "../entities/Ingame";
import { AppDataSource } from "../data-source";
import { Pokebox } from "../entities/Pokebox";
import { MyPokemonReq } from "../interfaces";
import { Backgrounds, PokemonSkill } from "../enums";

export class PokeboxService {
  private static get ingameRepo(): Repository<Ingame> {
    return AppDataSource.getRepository(Ingame);
  }

  private static get pokeboxRepo(): Repository<Pokebox> {
    return AppDataSource.getRepository(Pokebox);
  }

  static async addPokemon(user: number, pokemon: MyPokemonReq) {
    if (!user) throw Error("empty user.");

    const userdata = await this.ingameRepo.findOneBy({
      account_id: user,
    });
    if (!userdata) throw Error("empty user data.");

    const exist = await this.pokeboxRepo.findOneBy({
      account_id: user,
      pokedex: pokemon.pokedex,
      gender: pokemon.gender,
    });

    if (exist) {
      const currentSkills = exist.skill || [];
      const hasSkill =
        pokemon.skill !== PokemonSkill.NONE &&
        !currentSkills.includes(pokemon.skill);
      const newSkill = hasSkill
        ? [...currentSkills, pokemon.skill]
        : currentSkills;

      await this.pokeboxRepo.update(
        { account_id: user, pokedex: pokemon.pokedex, gender: pokemon.gender },
        {
          shiny: pokemon.shiny,
          form: pokemon.form,
          count: exist.count + 1,
          skill: newSkill,
          capture_location: pokemon.location,
          capture_ball: pokemon.capture_ball,
        }
      );
    } else {
      const newPokemon = this.pokeboxRepo.create({
        account_id: user,
        pokedex: pokemon.pokedex,
        gender: pokemon.gender,
        shiny: pokemon.shiny,
        form: pokemon.form,
        skill: pokemon.skill === "none" ? [] : [pokemon.skill],
        box: Backgrounds.ZERO,
        capture_location: pokemon.location,
        capture_ball: pokemon.capture_ball,
      });

      await this.pokeboxRepo.save(newPokemon);
    }
  }
}
