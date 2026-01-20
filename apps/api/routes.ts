import { Router } from 'express';
import authRoutes from './domains/auth/auth.route';
import userRoutes from './domains/user/user.route';

const apiRouter = Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/user', userRoutes);

export default apiRouter;
