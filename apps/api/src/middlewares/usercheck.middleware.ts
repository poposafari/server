import { Request, Response, NextFunction } from "express";
import { InvalidTokenHttpError, NotFoundAccountHttpError, NotFoundUserHttpError } from "../utils/http-error";
import { Repo } from "../utils/repo";

export const Usercheck = async (req: Request, res: Response, next: NextFunction) => {
  const user = res.locals.user.id;
  const account = await Repo.account.findOneBy({ id: user });
  const ingame = await Repo.ingame.findOneBy({ account_id: user });

  if (!user) return next(new InvalidTokenHttpError());
  if (!account) return next(new NotFoundAccountHttpError());
  if (!ingame) return next(new NotFoundUserHttpError());

  res.locals.ingame = ingame;

  return next();
};
