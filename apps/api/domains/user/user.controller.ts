import { FastifyRequest, FastifyReply } from 'fastify';
import { UserService } from './user.service';
import { CreateUserInput } from './user.schema';

export class UserController {
  constructor(private readonly userService: UserService) {}

  createUser = async (request: FastifyRequest, reply: FastifyReply) => {
    await this.userService.createUser(request.authId, request.body as CreateUserInput);
    return reply.status(201).send({ success: true, data: null });
  };

  getMe = async (request: FastifyRequest, reply: FastifyReply) => {
    const data = await this.userService.getMyGameData(request.authId);
    return reply.status(200).send({ success: true, data });
  };
}
