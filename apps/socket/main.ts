import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { initializeDatabase } from './db';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { registerEvent } from './app';

async function boot() {
  try {
    await initializeDatabase();

    const httpServer = createServer();

    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map((o) => o.trim()) ?? [];
    const isDevelopment = process.env.NODE_ENV === 'dev' || process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;

    const corsOrigin = (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) {
        console.error('Socket CORS blocked: No origin');
        return callback(null, false);
      }

      if (isDevelopment && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.error(`Socket CORS blocked: ${origin}`);
      callback(null, false);
    };

    const io = new Server(httpServer, {
      cors: {
        origin: corsOrigin,
        credentials: true,
      },
      path: '/socket.io',
      transports: ['websocket', 'polling'],
    });

    registerEvent(io);

    httpServer.listen(3001, '0.0.0.0', () => {
      console.log('socket server is running on 3001');
    });
  } catch (err) {
    console.error('connection failed:', err);
  }
}

boot();
