export enum AppErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  DTO_INVALID = 'DTO_INVALID',
  SESSION_MISSING = 'SESSION_MISSING',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  ACCOUNT_ALREADY_EXIST = 'ACCOUNT_ALREADY_EXIST',
  FAILED_ACCOUNT = 'FAILED_ACCOUNT',
  ACCOUNT_ALREADY_DELETED = 'ACCOUNT_ALREADY_DELETED',
  EXCEED_REQUEST = 'EXCEED_REQUEST',
}

export enum AppErrorMessage {
  NETWORK_ERROR = 'Network error',
  INTERNAL_SERVER_ERROR = 'Interval Server Error',
  NOT_FOUND = 'Not found.',
  DTO_INVALID = 'Dto Invalidation Error.',
  SESSION_MISSING = 'Session is missing',
  SESSION_EXPIRED = 'Session is Expired',
  ACCOUNT_ALREADY_EXIST = 'Account already exist',
  FAILED_ACCOUNT = 'Account Failed',
  ACCOUNT_ALREADY_DELETED = 'Account already deleted',
}

export interface AppErrorRes {
  success: false;
  error: {
    code: AppErrorCode;
    message: string | null;
    status: number;
  };
}
