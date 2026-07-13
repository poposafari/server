export type AuditSource = 'api' | 'socket';

export enum AuditAction {
  // auth / user
  REGISTER_LOCAL = 'REGISTER_LOCAL',
  LOGIN_LOCAL = 'LOGIN_LOCAL',
  LOGIN_OAUTH = 'LOGIN_OAUTH',
  LOGOUT = 'LOGOUT',
  DELETE_AUTH = 'DELETE_AUTH',
  CREATE_USER = 'CREATE_USER',
  // item
  ITEM_BUY = 'ITEM_BUY',
  ITEM_SELL = 'ITEM_SELL',
  ITEM_GIVE_HOLD = 'ITEM_GIVE_HOLD',
  ITEM_TAKE_HOLD = 'ITEM_TAKE_HOLD',
  ITEM_REGISTER = 'ITEM_REGISTER',
  ITEM_UNREGISTER = 'ITEM_UNREGISTER',
  // pokemon
  POKEMON_CATCH = 'POKEMON_CATCH',
  POKEMON_SELL = 'POKEMON_SELL',
  POKEMON_EVOLVE = 'POKEMON_EVOLVE',
  POKEMON_ENHANCE = 'POKEMON_ENHANCE',
  POKEMON_LEARN_MOVE = 'POKEMON_LEARN_MOVE',
  POKEMON_ARRANGE = 'POKEMON_ARRANGE',
  POKEMON_UPGRADE = 'POKEMON_UPGRADE',
  // fossil / safari
  FOSSIL_RESTORE = 'FOSSIL_RESTORE',
  SAFARI_ENTER = 'SAFARI_ENTER',
  SAFARI_EXIT = 'SAFARI_EXIT',
  SAFARI_PICK_ITEM = 'SAFARI_PICK_ITEM',
  SAFARI_BAIT = 'SAFARI_BAIT',
  SAFARI_ROCK = 'SAFARI_ROCK',
  // socket
  MAP_CHANGE = 'MAP_CHANGE',
  PET_CHANGE = 'PET_CHANGE',
  // 실패/보안 (코멘트 2)
  LOGIN_FAILED = 'LOGIN_FAILED',
  REQUEST_REJECTED = 'REQUEST_REJECTED',
}

export interface AuditEntry {
  accountId: number | null;
  action: AuditAction;
  status?: number | null;
  detail?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
  source: AuditSource;
}
