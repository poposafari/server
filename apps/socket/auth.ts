import cookieParser from 'cookie-parser';
import * as dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';

dotenv.config();

const JwtSecret = process.env.ACCESS_TOKEN_SECRET;

export function setAuth(io: Server) {
  io.use((socket, next) => {
    const cookieHeader = socket.handshake.headers.cookie;
    if (!cookieHeader) return next(new Error('No cookie provided'));

    const req = { headers: { cookie: cookieHeader } } as any;
    const res = {} as any;

    cookieParser()(req, res, () => {
      const token = req.cookies?.access_token;
      if (!token) return next(new Error('No access_token found in cookies'));
      try {
        const payload = jwt.verify(token, JwtSecret!) as any;
        socket.data.account_id = payload.id;
        return next();
      } catch (err) {
        return next(new Error('Invalid access_token'));
      }
    });
  });
}
