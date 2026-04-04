import { FastifyRequest, FastifyReply } from 'fastify';
import { PokemonService } from './pokemon.service';

export class PokemonController {
  constructor(private readonly pokemonService: PokemonService) {}

  getBox = async (request: FastifyRequest, reply: FastifyReply) => {
    const data = await this.pokemonService.getBox(request.authId);
    return reply.status(200).send({ success: true, data });
  };

  evolve = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { id: number; cost: string };
    const data = await this.pokemonService.evolve(request.authId, body);
    return reply.status(200).send({ success: true, data });
  };

  sell = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { id: number };
    const data = await this.pokemonService.sell(request.authId, body);
    return reply.status(200).send({ success: true, data });
  };

  learnMove = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { id: number; move: string };
    const data = await this.pokemonService.learnMove(request.authId, body);
    return reply.status(200).send({ success: true, data });
  };
}
