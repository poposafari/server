import { AppErrorCode } from '@poposerver/shared';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: AppErrorCode;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    code: AppErrorCode = AppErrorCode.INTERNAL_SERVER_ERROR,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Object.setPrototypeOf(this, AppError.prototype);
  }
}
