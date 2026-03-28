import { FastifyRequest, FastifyReply } from 'fastify';
import { CostumeService } from './costume.service';

export class CostumeController {
  constructor(private readonly costumeService: CostumeService) {}

  getAll = async (request: FastifyRequest, reply: FastifyReply) => {
    const data = await this.costumeService.getAll(request.authId);
    return reply.status(200).send({ success: true, data });
  };
}
