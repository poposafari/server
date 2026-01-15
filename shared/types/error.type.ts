export enum AppErrorCode {
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  UNAUTHORIZED = 'UNAUTHORIZED',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AT_EXPIRED = 'AC_EXPIRED',
  RT_EXPIRED = 'RT_EXPIRED',
}

export enum AppErrorMessage {
  USER_ALREADY_EXISTS = 'User already exists',
}

export interface AppErrorRes {
  success: false;
  timestamp: string;
  error: {
    code: AppErrorCode;
    message: string;
    status: number;
  };
}
