import { FastifyReply, FastifyRequest } from 'fastify';
import { QueueService } from './queue.service';

export class QueueController {
  constructor(private readonly service: QueueService) {}

  status = async (request: FastifyRequest, reply: FastifyReply) => {
    const authId = request.authId!;
    const result = await this.service.status(authId);
    return reply.status(200).send({ success: true, data: result });
  };

  cancel = async (request: FastifyRequest, reply: FastifyReply) => {
    const authId = request.authId!;
    await this.service.cancel(authId);
    return reply.status(200).send({ success: true, data: { ok: true } });
  };
}
