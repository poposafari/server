export class HttpError extends Error {
  private status: number;

  constructor(msg: string, status: number) {
    super(msg);

    this.status = status;

    Object.setPrototypeOf(this, HttpError.prototype);
  }

  getStatus() {
    return this.status;
  }
}

export class ConflictHttpError extends HttpError {
  constructor(msg: string) {
    super(msg, 409);
  }
}

export class BadRequestHttpError extends HttpError {
  constructor(msg: string) {
    super(msg, 400);
  }
}

export class NotFountHttpError extends HttpError {
  constructor(msg: string) {
    super(msg, 404);
  }
}
