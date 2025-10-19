import { pgClient } from './db';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { registerEvent } from './app';

async function boot() {
  try {
    await pgClient.connect();
    console.log('postgresql connected...');

    const httpServer = createServer();

    const io = new Server(httpServer, {
      cors: {
        origin: 'http://localhost:5173',
        credentials: true,
      },
      path: '/socket',
    });

    registerEvent(io);

    httpServer.listen(3001, () => {
      console.log('socket server is running on 3001');
    });
  } catch (err) {
    console.error('connection failed:', err);
  }
}

boot();
