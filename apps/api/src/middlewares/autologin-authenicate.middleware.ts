import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { InvalidAccessTokenHttpError, NotFoundAccessToken, NotFoundAccountHttpError, NotFoundToken } from '../utils/http-error';
import { Repo } from '../utils/repo';

export const AuthenticateForAccountRestore = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers['authorization'];
    const accessToken = authHeader && authHeader.split(' ')[1];

    console.log(authHeader, accessToken);

    if (!accessToken) {
      return next(new NotFoundAccessToken());
    }

    const payload = verifyAccessToken(accessToken) as { id: number };
    const account = await Repo.account.findOneBy({ id: payload.id });

    if (!account) {
      return next(new NotFoundAccountHttpError());
    }

    res.locals.account = account;
    next();
  } catch (err) {
    return next(new InvalidAccessTokenHttpError());
  }
};
