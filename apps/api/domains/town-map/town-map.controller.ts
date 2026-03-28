import { FastifyRequest, FastifyReply } from 'fastify';
import { TownMapService } from './town-map.service';

export class TownMapController {
  constructor(private readonly townMapService: TownMapService) {}

  getAll = async (request: FastifyRequest, reply: FastifyReply) => {
    const data = await this.townMapService.getAll(request.authId);
    return reply.status(200).send({ success: true, data });
  };
}
