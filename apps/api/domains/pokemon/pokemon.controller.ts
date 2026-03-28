import { FastifyRequest, FastifyReply } from 'fastify';
import { PokemonService } from './pokemon.service';

export class PokemonController {
  constructor(private readonly pokemonService: PokemonService) {}

  getBox = async (request: FastifyRequest, reply: FastifyReply) => {
    const data = await this.pokemonService.getBox(request.authId);
    return reply.status(200).send({ success: true, data });
  };
}
