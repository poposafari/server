export enum AppErrorCode {
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  DTO_INVALID = 'DTO_INVALID',
  RT_MISSING = 'RT_MISSING',
  AT_MISSING = 'AT_MISSING',
  AT_EXPIRED = 'AT_EXPIRED',
  USER_ALREADY_EXISTS = 'USER_ALREADY_EXISTS',
  FAILED_LOGIN = 'FAILED_LOGIN',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  USER_ALREADY_DELETED = 'USER_ALREADY_DELETED',
  PC_BOX_FULL = 'PC_BOX_FULL',
  BAG_QUANTITY_EXCEEDED = 'BAG_QUANTITY_EXCEEDED',
  NOT_NEWBIE = 'NOT_NEWBIE',
}

export enum AppErrorMessage {
  INTERNAL_SERVER_ERROR = 'Interval Server Error.',
  NOT_FOUND = 'Not found.',
  DTO_INVALID = 'Dto Invalidation Error.',
  RT_MISSING = 'Refresh token missing.',
  AT_MISSING = 'Access token missing.',
  AT_EXPIRED = 'Access token expired',
  USER_ALREADY_EXISTS = 'User already exists.',
  FAILED_LOGIN = 'Failed login.',
  USER_NOT_FOUND = 'User not found.',
  USER_ALREADY_DELETED = 'User already deleted.',
  PC_BOX_FULL = 'PC box is full.',
  BAG_QUANTITY_EXCEEDED = 'Item quantity cannot exceed 999.',
  NOT_NEWBIE = 'Starter selection is only available for new users.',
}

export interface AppErrorRes {
  success: false;
  // timestamp: string;
  error: {
    code: AppErrorCode;
    message: string | null;
    status: number;
  };
}
