import cookieParser from 'cookie-parser';
import * as dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';

dotenv.config();

const JwtSecret = process.env.ACCESS_TOKEN_SECRET;

export interface JwtPayload {
  id: number;
  type: string;
  iat: number;
  exp: number;
}

export function parseCookieAndGetPayload(cookieHeader: string): JwtPayload | null {
  try {
    const req = { headers: { cookie: cookieHeader } } as any;
    const res = {} as any;

    cookieParser()(req, res, () => {
      const token = req.cookies?.access_token;
      if (!token) return null;

      try {
        const payload = jwt.verify(token, JwtSecret!) as JwtPayload;
        return payload;
      } catch (err) {
        return null;
      }
    });

    return null;
  } catch (error) {
    return null;
  }
}

export function parseAccessToken(token: string): JwtPayload | null {
  try {
    const payload = jwt.verify(token, JwtSecret!) as JwtPayload;
    return payload;
  } catch (err) {
    return null;
  }
}
