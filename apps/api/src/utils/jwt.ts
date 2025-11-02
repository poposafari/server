import jwt from 'jsonwebtoken';

import * as dotenv from 'dotenv';

dotenv.config();

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

export const createAccessToken = (payload: object): string => {
  return jwt.sign(payload, JWT_ACCESS_SECRET!, {
    expiresIn: '15m',
  });
};

export const createRefreshToken = (payload: object): string => {
  return jwt.sign(payload, JWT_REFRESH_SECRET!, {
    expiresIn: '7d',
  });
};

export const verifyAccessToken = (token: string) => {
  return jwt.verify(token, JWT_ACCESS_SECRET!);
};

export const verifyRefreshToken = (token: string) => {
  return jwt.verify(token, JWT_REFRESH_SECRET!);
};
