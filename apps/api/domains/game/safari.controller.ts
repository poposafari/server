import { FastifyReply, FastifyRequest } from 'fastify';
import { SafariService } from './safari.service';

export class SafariController {
  constructor(private readonly service: SafariService) {}

  enter = async (request: FastifyRequest, reply: FastifyReply) => {
    const { mapId, needEntry } = request.body as { mapId: string; needEntry: boolean };
    const data = await this.service.enter(request.authId!, mapId, needEntry);
    return reply.status(200).send({ success: true, data });
  };

  pickItem = async (request: FastifyRequest, reply: FastifyReply) => {
    const { uid } = request.body as { uid: string };
    const data = await this.service.pickItem(request.authId!, uid);
    return reply.status(200).send({ success: true, data });
  };

  catchWild = async (request: FastifyRequest, reply: FastifyReply) => {
    const { uid, bait, rock } = request.body as {
      uid: string;
      bait: boolean;
      rock: boolean;
    };
    const data = await this.service.catchWild(request.authId!, uid, bait, rock);
    return reply.status(200).send({ success: true, data });
  };

  exit = async (request: FastifyRequest, reply: FastifyReply) => {
    const data = await this.service.exit(request.authId!);
    return reply.status(200).send({ success: true, data });
  };
}
