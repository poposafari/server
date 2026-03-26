import { CookieSerializeOptions } from '@fastify/cookie';
import { envConfig } from './env';

const cookieDomain = (() => {
  if (!envConfig.CORS_ORIGIN) return undefined;
  const host = envConfig.CORS_ORIGIN.replace(/^https?:\/\//, '').split(/[:/]/)[0];
  if (!host || host === 'localhost') return undefined;
  return host;
})();

export const SESSION_COOKIE_NAME = 'sid';

export const sessionCookieOptions: CookieSerializeOptions = {
  httpOnly: true,
  secure: envConfig.NODE_ENV === 'PROD',
  sameSite: envConfig.NODE_ENV === 'PROD' ? 'strict' : 'lax',
  maxAge: 7 * 24 * 60 * 60, // 7일 (초 단위)
  path: '/',
  ...(cookieDomain && { domain: cookieDomain }),
};
