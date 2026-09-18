import { Router } from 'express';
import { sessionAuthGuard } from '../../hooks/session-auth.hook';
import { CostumeController } from './costume.controller';
import { CostumeService } from './costume.service';
import { CostumeRepository } from './costume.repository';

const router = Router();

const repo = new CostumeRepository();
const service = new CostumeService(repo);
const controller = new CostumeController(service);

router.get('/users/me/costumes', sessionAuthGuard, controller.getAll);

export default router;
