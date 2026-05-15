import { FastifyReply, FastifyRequest } from 'fastify';
import { GameService } from './game.service';

export class GameController {
  constructor(private readonly service: GameService) {}

  connect = async (request: FastifyRequest, reply: FastifyReply) => {
    const authId = request.authId!;
    const result = await this.service.connect(authId);
    return reply.status(200).send({ success: true, data: result });
  };

  getOnlineCount = async (_request: FastifyRequest, reply: FastifyReply) => {
    const count = await this.service.getOnlineCount();
    return reply.status(200).send({ success: true, data: { count } });
  };
}
