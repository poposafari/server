import { Request, Response } from "express";
import {
  addItem,
  addPokemon,
  buyItem,
  getAvailableTicket,
  getIngame,
  getItemByCategory,
  getItems,
  getPokebox,
  login,
  movePokemon,
  receiveAvailableTicket,
  registerAccount,
  registerIngame,
  removeAccount,
  updateItemSlot,
  updateParty,
  updatePokeboxBg,
  useItem,
  useTicket,
} from "./services";
import { LoginFailHttpError } from "./utils/http-error";
import { createTokens, gameSuccess } from "./utils/methods";
import { WrapController } from "./utils/wrap-controller";
import { CookieConfig } from "./utils/options";
import { redis } from "./data-source";

class AccountController {
  static async register(req: Request, res: Response): Promise<any> {
    const newAccount = await registerAccount(req.body);
    const accessToken = createTokens(newAccount.id!);

    return res
      .cookie("access_token", accessToken, CookieConfig as any)
      .status(201)
      .json(gameSuccess(null));
  }

  static async login(req: Request, res: Response): Promise<any> {
    const account = await login(req.body);

    if (!account || !account.id) throw new LoginFailHttpError();

    const accessToken = createTokens(account.id);
    console.log(accessToken);

    return res
      .cookie("access_token", accessToken, CookieConfig as any)
      .status(200)
      .json(gameSuccess(null));
  }

  static async autoLogin(req: Request, res: Response): Promise<any> {
    return res.status(200).json(gameSuccess(res.locals.ingame));
  }

  static async logout(req: Request, res: Response): Promise<any> {
    await redis.del(`refresh:${res.locals.user.id}`);
    return res
      .clearCookie("access_token", CookieConfig as any)
      .status(200)
      .json(gameSuccess(null));
  }

  static async removeAccount(req: Request, res: Response): Promise<any> {
    const ret = await removeAccount(res.locals.user.id);
    await redis.del(`refresh:${res.locals.user.id}`);
    return res
      .clearCookie("access_token", CookieConfig as any)
      .status(200)
      .json(ret);
  }
}

class IngameController {
  static async register(req: Request, res: Response): Promise<any> {
    const ret = await registerIngame(req.body, res.locals.user.id);
    return res.status(201).json(ret);
  }

  static async getUserData(req: Request, res: Response): Promise<any> {
    const ret = await getIngame(res.locals.ingame);
    return res.status(200).json(ret);
  }

  static async updateItemSlot(req: Request, res: Response): Promise<any> {
    const ret = await updateItemSlot(res.locals.ingame, req.body);
    return res.status(200).json(ret);
  }

  static async updateParty(req: Request, res: Response): Promise<any> {
    const ret = await updateParty(res.locals.ingame, req.body);
    return res.status(200).json(ret);
  }

  static async updatePokeboxBg(req: Request, res: Response): Promise<any> {
    const ret = await updatePokeboxBg(res.locals.ingame, req.body);
    return res.status(200).json(ret);
  }

  static async getAvailableTicket(req: Request, res: Response): Promise<any> {
    const ret = await getAvailableTicket(res.locals.ingame);
    return res.status(200).json(ret);
  }

  static async receiveAvailableTicket(req: Request, res: Response): Promise<any> {
    const ret = await receiveAvailableTicket(res.locals.ingame);
    return res.status(200).json(ret);
  }
}

class BagController {
  static async addItem(req: Request, res: Response): Promise<any> {
    const ret = await addItem(res.locals.ingame, req.body);
    return res.status(201).json(ret);
  }

  static async useItem(req: Request, res: Response): Promise<any> {
    const ret = await useItem(res.locals.ingame, req.body);
    return res.status(200).json(ret);
  }

  static async getItemByCategory(req: Request, res: Response): Promise<any> {
    const ret = await getItemByCategory(res.locals.ingame, req.body);
    return res.status(200).json(ret);
  }

  static async getItems(req: Request, res: Response): Promise<any> {
    const ret = await getItems(res.locals.ingame);
    return res.status(200).json(ret);
  }

  static async buyItem(req: Request, res: Response): Promise<any> {
    const ret = await buyItem(res.locals.ingame, req.body);
    return res.status(201).json(ret);
  }
}

class PokeboxController {
  static async addPokemon(req: Request, res: Response): Promise<any> {
    const ret = await addPokemon(res.locals.ingame, req.body);
    return res.status(201).json(ret);
  }

  static async getPokebox(req: Request, res: Response): Promise<any> {
    const ret = await getPokebox(res.locals.ingame, req.body);
    return res.status(200).json(ret);
  }

  static async movePokemon(req: Request, res: Response): Promise<any> {
    const ret = await movePokemon(res.locals.ingame, req.body);
    return res.status(200).json(ret);
  }
}

class SafariController {
  static async useTicket(req: Request, res: Response): Promise<any> {
    const ret = await useTicket(res.locals.ingame, req.body);
    return res.status(200).json(ret);
  }
}

export const Controllers = {
  Account: WrapController(AccountController),
  Ingame: WrapController(IngameController),
  Bag: WrapController(BagController),
  Pokebox: WrapController(PokeboxController),
  Safari: WrapController(SafariController),
};
