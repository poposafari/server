import { FastifyInstance } from 'fastify';
import { sessionAuthGuard } from '../../hooks/session-auth.hook';
import { zodValidate } from '../../hooks/validate.hook';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { UserRepository } from './user.repository';
import { createUserSchema } from './user.schema';

export default async function userRoutes(app: FastifyInstance) {
  const userRepo = new UserRepository();
  const userService = new UserService(userRepo);
  const userController = new UserController(userService);

  app.post('/create', {
    preHandler: [sessionAuthGuard, zodValidate(createUserSchema)],
    handler: userController.createUser,
  });

  app.get('/me', {
    preHandler: [sessionAuthGuard],
    handler: userController.getMe,
  });
}
