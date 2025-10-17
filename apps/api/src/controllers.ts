import { Request, Response } from 'express';
import { LoginFailHttpError, NotFoundToken } from './utils/http-error';
import { createTokens, gameSuccess } from './utils/methods';
import { WrapController } from './utils/wrap-controller';
import { CookieConfig } from './utils/options';
import {
  addIngameItem,
  addPcPokemon,
  autoLogin,
  buyItem,
  catchGroundItem,
  catchStarterPokemon,
  catchWild,
  checkRefreshToken,
  deleteAccount,
  deleteRestoreAccount,
  enterSafariZone,
  evolvePc,
  exitSafariZone,
  getAvailableTicket,
  getIngame,
  getIngameItems,
  getPc,
  loginLocal,
  movePc,
  receiveAvailableTicket,
  registerIngame,
  registerLocal,
  useSafariTicket,
} from './services';
import { Account } from './entities/Account';

class AccountController {
  static async registerLocal(req: Request, res: Response): Promise<any> {
    const newAccount = await registerLocal(req.body);
    const accessToken = createTokens(newAccount.id!, 'access');
    const refreshToken = createTokens(newAccount.id!, 'refresh');

    res.cookie('refresh_token', refreshToken, CookieConfig as any).status(200);

    return res.status(200).json(gameSuccess(accessToken));
  }

  static async loginLocal(req: Request, res: Response): Promise<any> {
    let ret;
    const account = await loginLocal(req.body);

    if (!account || !account.id) throw new LoginFailHttpError();

    const accessToken = createTokens(account.id, 'access');
    const refreshToken = createTokens(account.id, 'refresh');

    res.cookie('refresh_token', refreshToken, CookieConfig as any).status(200);

    ret = {
      token: accessToken,
      isDelete: account.isDelete,
      isDeleteAt: account.isDeleteAt,
    };

    return res.status(200).json(gameSuccess(ret));
  }

  static async checkRefreshToken(req: Request, res: Response): Promise<any> {
    const refreshToken = req.cookies.refresh_token;

    if (!refreshToken) throw new NotFoundToken();

    const newAccessToken = await checkRefreshToken(refreshToken);
    return res.status(200).json(gameSuccess(newAccessToken));
  }

  static async autoLogin(req: Request, res: Response): Promise<any> {
    const account = res.locals.account as Account;
    const ret = await autoLogin();

    return res.status(200).json(ret);
  }

  static async logout(req: Request, res: Response): Promise<any> {
    return res
      .clearCookie('refresh_token', CookieConfig as any)
      .status(200)
      .json(gameSuccess(null));
  }

  static async deleteAccount(req: Request, res: Response): Promise<any> {
    const ret = await deleteAccount(res.locals.account);
    return res
      .clearCookie('refresh_token', CookieConfig as any)
      .status(200)
      .json(ret);
  }

  static async deleteRestoreAccount(req: Request, res: Response): Promise<any> {
    const ret = await deleteRestoreAccount(res.locals.account);
    return res.status(200).json(ret);
  }
}

class IngameController {
  static async getIngame(req: Request, res: Response): Promise<any> {
    const ret = await getIngame(res.locals.account);
    return res.status(200).json(gameSuccess(ret));
  }

  static async registerIngame(req: Request, res: Response): Promise<any> {
    const ret = await registerIngame(req.body, res.locals.account);
    return res.status(201).json(ret);
  }

  static async getAvailableTicket(req: Request, res: Response): Promise<any> {
    const ret = await getAvailableTicket(res.locals.account);
    return res.status(200).json(ret);
  }

  static async receiveAvailableTicket(req: Request, res: Response): Promise<any> {
    const ret = await receiveAvailableTicket(res.locals.account);
    return res.status(200).json(ret);
  }
}

class BagController {
  static async addIngameItem(req: Request, res: Response): Promise<any> {
    const ret = await addIngameItem(res.locals.account, req.body);
    return res.status(200).json(ret);
  }

  static async getIngameItems(req: Request, res: Response): Promise<any> {
    const ret = await getIngameItems(res.locals.account);
    return res.status(200).json(ret);
  }

  static async buyIngameItem(req: Request, res: Response): Promise<any> {
    const ret = await buyItem(res.locals.account, req.body);
    return res.status(200).json(ret);
  }

  static async useSafariTicket(req: Request, res: Response): Promise<any> {
    const ret = await useSafariTicket(res.locals.account, req.body);
    return res.status(200).json(ret);
  }
}

class PcController {
  static async addPcPokemon(req: Request, res: Response): Promise<any> {
    const ret = await addPcPokemon(res.locals.account, req.body);
    return res.status(200).json(ret);
  }

  static async getPc(req: Request, res: Response): Promise<any> {
    const ret = await getPc(res.locals.account, req.body);
    return res.status(200).json(ret);
  }

  static async movePc(req: Request, res: Response): Promise<any> {
    const ret = await movePc(res.locals.account, req.body);
    return res.status(200).json(ret);
  }

  static async evolvePc(req: Request, res: Response): Promise<any> {
    const ret = await evolvePc(res.locals.account, req.body);
    return res.status(200).json(ret);
  }
}

class SafariController {
  static async enterSafariZone(req: Request, res: Response): Promise<any> {
    const ret = await enterSafariZone(res.locals.account, req.body);
    return res.status(200).json(ret);
  }

  static async exitSafariZone(req: Request, res: Response): Promise<any> {
    const ret = await exitSafariZone(res.locals.account);
    return res.status(200).json(ret);
  }

  static async catchWild(req: Request, res: Response): Promise<any> {
    const ret = await catchWild(res.locals.account, req.body);
    return res.status(200).json(ret);
  }

  static async catchGroundItem(req: Request, res: Response): Promise<any> {
    const ret = await catchGroundItem(res.locals.account, req.body);
    return res.status(200).json(ret);
  }

  static async catchStarterPokemon(req: Request, res: Response): Promise<any> {
    const ret = await catchStarterPokemon(res.locals.account, req.body);
    return res.status(200).json(ret);
  }
}

export const Controllers = {
  Account: WrapController(AccountController),
  Ingame: WrapController(IngameController),
  Bag: WrapController(BagController),
  PC: WrapController(PcController),
  Safari: WrapController(SafariController),
};
