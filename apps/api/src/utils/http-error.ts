import { HttpErrorCode } from '../shared/enums';

export class HttpError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
    Object.setPrototypeOf(this, HttpError.prototype);
  }

  toJson() {
    return {
      result: false,
      data: this.code,
    };
  }
}

export class DuplicateAccountHttpError extends HttpError {
  constructor() {
    super(409, HttpErrorCode.ALREADY_EXIST_ACCOUNT);
  }
}

export class DuplicateUserNicknameHttpError extends HttpError {
  constructor() {
    super(409, HttpErrorCode.ALREADY_EXIST_NICKNAME);
  }
}

export class LoginFailHttpError extends HttpError {
  constructor() {
    super(404, HttpErrorCode.LOGIN_FAIL);
  }
}

export class NotFoundAccountHttpError extends HttpError {
  constructor() {
    super(404, HttpErrorCode.NOT_FOUND_ACCOUNT);
  }
}

export class NotFoundIngame extends HttpError {
  constructor() {
    super(404, HttpErrorCode.NOT_FOUND_INGAME);
  }
}

export class NotFoundIngameItem extends HttpError {
  constructor() {
    super(404, HttpErrorCode.NOT_FOUND_INGAME_ITEM);
  }
}

export class NotFoundIngameItemType extends HttpError {
  constructor() {
    super(404, HttpErrorCode.NOT_FOUND_INGAME_ITEM_TYPE);
  }
}

export class IngameItemStockLimitExceeded extends HttpError {
  constructor() {
    super(404, HttpErrorCode.INGAME_ITEM_STOCK_LIMIT_EXCEEDED);
  }
}

export class NotPurchasableIngameItem extends HttpError {
  constructor() {
    super(404, HttpErrorCode.NOT_PURCHASABLE_INGAME_ITEM);
  }
}

export class IngamePcIsFull extends HttpError {
  constructor() {
    super(404, HttpErrorCode.INGAME_PC_IS_FULL);
  }
}

export class NotFoundIngamePc extends HttpError {
  constructor() {
    super(404, HttpErrorCode.NOT_FOUND_INGAME_PC);
  }
}

export class NotFoundPokemonData extends HttpError {
  constructor() {
    super(404, HttpErrorCode.NOT_FOUND_POKEMON_DATA);
  }
}

export class NoMoreEvolve extends HttpError {
  constructor() {
    super(404, HttpErrorCode.NO_MORE_EVOLVE);
  }
}

export class NotEnoughCandy extends HttpError {
  constructor() {
    super(404, HttpErrorCode.NOT_ENOUGH_CANDY);
  }
}

export class NotFoundSafariTicket extends HttpError {
  constructor() {
    super(404, HttpErrorCode.NOT_FOUND_SAFARI_TICKET);
  }
}

export class NotFoundToken extends HttpError {
  constructor() {
    super(401, HttpErrorCode.NOT_FOUND_TOKEN);
  }
}

export class NotFoundAccessToken extends HttpError {
  constructor() {
    super(401, HttpErrorCode.NOT_FOUND_ACCESS_TOKEN);
  }
}

export class NotFoundRefreshToken extends HttpError {
  constructor() {
    super(401, HttpErrorCode.NOT_FOUND_REFRESH_TOKEN);
  }
}

export class InvalidAccessTokenHttpError extends HttpError {
  constructor() {
    super(401, HttpErrorCode.INVALID_ACCESS_TOKEN);
  }
}

export class InvalidRefreshTokenHttpError extends HttpError {
  constructor() {
    super(401, HttpErrorCode.INVALID_REFRESH_TOKEN);
  }
}
