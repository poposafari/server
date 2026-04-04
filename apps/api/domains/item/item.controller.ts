import { FastifyRequest, FastifyReply } from 'fastify';
import { ItemService } from './item.service';

export class ItemController {
  constructor(private readonly itemService: ItemService) {}

  getBag = async (request: FastifyRequest, reply: FastifyReply) => {
    const data = await this.itemService.getBag(request.authId);
    return reply.status(200).send({ success: true, data });
  };

  buy = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { item: string; quantity: number };
    const data = await this.itemService.buy(request.authId, body);
    return reply.status(200).send({ success: true, data });
  };

  sell = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { item: string; quantity: number };
    const data = await this.itemService.sell(request.authId, body);
    return reply.status(200).send({ success: true, data });
  };
}
