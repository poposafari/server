import { FastifyRequest, FastifyReply } from 'fastify';
import { ItemService } from './item.service';

export class ItemController {
  constructor(private readonly itemService: ItemService) {}

  getBag = async (request: FastifyRequest, reply: FastifyReply) => {
    const data = await this.itemService.getBag(request.authId);
    return reply.status(200).send({ success: true, data });
  };
}
