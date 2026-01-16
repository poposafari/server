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
  INVALID_CREDENTIALS = 'Invalid credentials',
  UNAUTHORIZED = 'Unauthorized',
  REFRESH_TOKEN_MISSING = 'Refresh token missing',
  NOT_FOUND = 'Not found',
  USER_ALREADY_DELETED = 'User already deleted',
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
