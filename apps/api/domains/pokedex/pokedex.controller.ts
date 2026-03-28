import { FastifyRequest, FastifyReply } from 'fastify';
import { PokedexService } from './pokedex.service';

export class PokedexController {
  constructor(private readonly pokedexService: PokedexService) {}

  getAll = async (request: FastifyRequest, reply: FastifyReply) => {
    const data = await this.pokedexService.getAll(request.authId);
    return reply.status(200).send({ success: true, data });
  };
}
