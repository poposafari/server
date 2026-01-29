import { Router } from 'express';
import { UserRepository } from './user.repository';
import { BagRepository } from '../bag/bag.repository';
import { CostumeRepository } from '../costume/costume.repository';
import { PcRepository } from '../pc/pc.repository';
import { AuditRepository } from '../audit/audit.repository';
import {
  AppDataSource,
  AuditLog,
  User,
  UserBag,
  UserCostume,
  UserPokemon,
  validate,
} from '@poposerver/shared';
import { AuditService } from '../audit/audit.service';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { jwtAuthGuard } from 'apps/api/middlewares';
import { createUserSchema } from './user.schema';

const userRoutes = Router();

const userRepository = new UserRepository(AppDataSource.getRepository(User));
const bagRepository = new BagRepository(AppDataSource.getRepository(UserBag));
const costumeRepository = new CostumeRepository(AppDataSource.getRepository(UserCostume));
const pcRepository = new PcRepository(AppDataSource.getRepository(UserPokemon));
const auditRepository = new AuditRepository(AppDataSource.getRepository(AuditLog));

const auditService = new AuditService(auditRepository);
const userService = new UserService(
  AppDataSource,
  userRepository,
  bagRepository,
  costumeRepository,
  pcRepository,
);

const userController = new UserController(userService, auditService);

userRoutes.get('/get', jwtAuthGuard, userController.getUser);
userRoutes.post('/create', validate(createUserSchema), jwtAuthGuard, userController.createUser);

export default userRoutes;
