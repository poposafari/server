import { FastifyRequest, FastifyReply } from 'fastify';
import { FossilService } from './fossil.service';
import { RestoreFossilInput } from './fossil.schema';

export class FossilController {
  constructor(private readonly fossilService: FossilService) {}

  restore = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as RestoreFossilInput;
    const data = await this.fossilService.restore(request.authId, body.id);
    return reply.status(200).send({ success: true, data });
  };
}
