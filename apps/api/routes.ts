import { Router } from 'express';
import authRoutes from './domains/auth/auth.route';
import userRoutes from './domains/user/user.route';
import gameRoutes from './domains/game/game.route';

const apiRouter = Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/user', userRoutes);
apiRouter.use('/game', gameRoutes);

export default apiRouter;
