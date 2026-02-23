import jwt from 'jsonwebtoken';
import { envConfig } from './env';
import { CookieOptions } from 'express';

export interface TokenPayload {
  authId: string;
}

export interface TokenPair {
  authId?: string;
  accessToken: string;
  refreshToken: string;
}

// CORS_ORIGIN에서 호스트만 추출 (https://poposafari.net → poposafari.net)
// api/socket 등 서브도메인에서도 쿠키 전송되도록
const cookieDomain = envConfig.CORS_ORIGIN
  ? (envConfig.CORS_ORIGIN.replace(/^https?:\/\//, '').split('/')[0] ?? undefined)
  : undefined;

export const refreshTokenCookieOptions: CookieOptions = {
  httpOnly: true, //JavaScript에서 접근 불가.
  secure: envConfig.NODE_ENV === 'PROD', //PROD에서는 HTTPS에서만 접근 가능.
  sameSite: (envConfig.NODE_ENV === 'PROD' ? 'strict' : 'lax') as 'strict' | 'lax' | 'none',
  maxAge: 7 * 24 * 60 * 60 * 1000, //7 days
  path: '/',
  ...(cookieDomain && { domain: cookieDomain }),
};

export const REFRESH_TOKEN_COOKIE_NAME = 'refreshToken';

export function generateAccessToken(authId: string): string {
  const payload: TokenPayload = { authId };

  return jwt.sign(payload, envConfig.JWT_ACCESS_SECRET, { expiresIn: '15m' });
}

export function generateRefreshToken(authId: string): string {
  const payload: TokenPayload = { authId };

  return jwt.sign(payload, envConfig.JWT_REFRESH_SECRET, { expiresIn: '7d' });
}

export function generateTokenPair(authId: string): TokenPair {
  return {
    accessToken: generateAccessToken(authId),
    refreshToken: generateRefreshToken(authId),
  };
}

export function verifyToken(type: 'access' | 'refresh', token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(
      token,
      type === 'access' ? envConfig.JWT_ACCESS_SECRET : envConfig.JWT_REFRESH_SECRET,
    ) as TokenPayload;

    return decoded;
  } catch (error) {
    return null;
  }
}
