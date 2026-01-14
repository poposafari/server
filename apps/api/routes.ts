import { Router } from 'express';
import authRoutes from './domains/auth/auth.route';

const apiRouter = Router();

apiRouter.use('/auth', authRoutes);

export default apiRouter;
