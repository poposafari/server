import { FastifyRequest, FastifyReply } from 'fastify';
import { FossilService } from './fossil.service';
import { RestoreFossilParams } from './fossil.schema';

export class FossilController {
  constructor(private readonly fossilService: FossilService) {}

  restore = async (request: FastifyRequest, reply: FastifyReply) => {
    const { fossilId } = request.params as RestoreFossilParams;
    const data = await this.fossilService.restore(request.authId, fossilId, request.ip);
    return reply.status(201).send({ success: true, data });
  };
}
