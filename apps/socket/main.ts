import { registerEvent } from './app';
import { pgClient, redis } from './db';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { setAuth } from './auth';

export interface EnterOrExit {
  overworld: string;
  x: number;
  y: number;
}

export const EnterData: Record<string, EnterOrExit> = {};
export const ExitData: Record<string, EnterOrExit> = {};

async function boot() {
  try {
    await pgClient.connect();
    console.log('postgresql connected...');

    // await redis.connect();
    // console.log('redis connected');

    const httpServer = createServer();

    const io = new Server(httpServer, {
      cors: {
        origin: 'http://localhost:5173',
        credentials: true,
      },
      path: '/socket',
    });

    setAuth(io);
    registerEvent(io);

    httpServer.listen(3001, () => {
      console.log('socket server is running on 3001');
    });
  } catch (err) {
    console.error('connection failed:', err);
  }
}

boot();
