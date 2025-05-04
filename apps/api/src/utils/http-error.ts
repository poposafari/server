export class HttpError extends Error {
  constructor(public msg: string, public status: number, public code: string, public detail?: any) {
    super(msg);
    Object.setPrototypeOf(this, HttpError.prototype);
  }

  toJson() {
    return {
      msg: this.msg,
      status: this.status,
      code: this.code,
      detail: this.detail,
    };
  }
}

export class DuplicateAccountHttpError extends HttpError {
  constructor(msg = "Already exist account") {
    super(msg, 409, "ALREADY_EXIST_ACCOUNT", null);
  }
}

export class DuplicateUserNicknameHttpError extends HttpError {
  constructor(msg = "Already exist ingame nickname") {
    super(msg, 409, "ALREADY_EXIST_NICKNAME", null);
  }
}

export class NotFoundAccountHttpError extends HttpError {
  constructor(msg = "Not found account") {
    super(msg, 404, "NOT_FOUND_ACCOUNT", null);
  }
}

export class NotFoundUserHttpError extends HttpError {
  constructor(msg = "Not found ingame user") {
    super(msg, 404, "NOT_FOUND_USER", null);
  }
}

export class InvalidTokenHttpError extends HttpError {
  constructor(msg = "Invalid token") {
    super(msg, 401, "INVALID_TOKEN", null);
  }
}

export class SessionExpiredHttpError extends HttpError {
  constructor(msg = "Session expired") {
    super(msg, 440, "SESSION_EXPIRED");
  }
}

export class InvalidRefreshTokenHttpError extends HttpError {
  constructor(msg = "Refresh token is invalid or expired") {
    super(msg, 401, "INVALID_REFRESH_TOKEN", null);
  }
}
