import { FastifyReply, FastifyRequest } from 'fastify';
import { GameService } from './game.service';

export class GameController {
  constructor(private readonly service: GameService) {}

  connect = async (request: FastifyRequest, reply: FastifyReply) => {
    const authId = request.authId!;
    const token = await this.service.issueConnToken(authId);
    return reply.status(200).send({ success: true, data: { token } });
  };
}
