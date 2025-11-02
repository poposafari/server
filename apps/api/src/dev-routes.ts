import { Router, Request, Response } from 'express';
import { createAccessToken, createRefreshToken } from './utils/jwt';

const DevRouter = Router();

DevRouter.get('/token/:userId', (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'prod') {
    return res.status(403).json({ error: 'This endpoint is only available in development' });
  }

  const userId = parseInt(req.params.userId);
  if (isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  const accessToken = createAccessToken({ id: userId });
  const refreshToken = createRefreshToken({ id: userId });

  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7,
  });

  res.json({
    result: true,
    data: {
      token: accessToken,
      isDelete: false,
      isDeleteAt: null,
      userId,
    },
  });
});

export default DevRouter;
