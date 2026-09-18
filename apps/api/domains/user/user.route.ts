import { Router } from 'express';
import { sessionAuthGuard } from '../../hooks/session-auth.hook';
import { zodValidate } from '../../hooks/validate.hook';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { UserRepository } from './user.repository';
import { createUserSchema } from './user.schema';

const router = Router();

const userRepo = new UserRepository();
const userService = new UserService(userRepo);
const userController = new UserController(userService);

router.post(
  '/users',
  sessionAuthGuard,
  zodValidate({ body: createUserSchema }),
  userController.createUser,
);

router.get('/users/me', sessionAuthGuard, userController.getMe);

export default router;
