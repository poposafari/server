import { FastifyReply, FastifyRequest } from 'fastify';
import { SafariService } from './safari.service';

export class SafariController {
  constructor(private readonly service: SafariService) {}

  enter = async (request: FastifyRequest, reply: FastifyReply) => {
    const { mapId } = request.body as { mapId: string };
    const data = await this.service.enter(request.authId!, mapId);
    return reply.status(200).send({ success: true, data });
  };

  exit = async (request: FastifyRequest, reply: FastifyReply) => {
    await this.service.exit(request.authId!);
    return reply.status(200).send({ success: true, data: null });
  };
}
