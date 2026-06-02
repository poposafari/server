import { FastifyRequest, FastifyReply } from 'fastify';
import { AuditAction } from '@poposerver/lib/types';
import { UserService } from './user.service';
import { CreateUserInput } from './user.schema';

export class UserController {
  constructor(private readonly userService: UserService) {}

  createUser = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as CreateUserInput;
    await this.userService.createUser(request.authId, body);
    request.audit = {
      action: AuditAction.CREATE_USER,
      detail: { nickname: body.nickname, gender: body.gender },
    };
    return reply.status(201).send({ success: true, data: null });
  };

  getMe = async (request: FastifyRequest, reply: FastifyReply) => {
    const data = await this.userService.getMyGameData(request.authId);
    return reply.status(200).send({ success: true, data });
  };
}
