import { initializeDatabase } from './db';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { registerEvent } from './app';
import * as dotenv from 'dotenv';

dotenv.config();

async function boot() {
  try {
    await initializeDatabase();

    const httpServer = createServer();

    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') ?? [];

    const io = new Server(httpServer, {
      cors: {
        origin: allowedOrigins.length > 0 ? allowedOrigins : 'http://localhost:5173',
        credentials: true,
      },
      path: '/socket.io',
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
