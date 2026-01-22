import * as jwt from 'jsonwebtoken';
import { envConfig, logger } from '@poposerver/shared';
import { createServer, Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';

export class SocketApp {
  private httpServer: HttpServer;
  private io: SocketIOServer;

  constructor() {
    this.httpServer = createServer();

    this.io = new SocketIOServer(this.httpServer, {
      cors: {
        origin: envConfig.CORS_ORIGIN || '*',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
    });

    this.initMiddlewares();
    this.initEvents();
  }

  listen() {
    this.httpServer.listen(envConfig.SOCKET_PORT, () => {
      logger.info(`SOCKET Server is running on port ${envConfig.SOCKET_PORT}`);
    });
  }

  async close() {
    return new Promise<void>((resolve, reject) => {
      this.io.close(() => {
        this.httpServer.close((err) => {
          if (err) return reject(err);
          resolve();
        });
      });
    });
  }

  private initMiddlewares() {
    this.io.use((socket, next) => {
      try {
        const rawToken = socket.handshake.auth.token || socket.handshake.headers.token;
        
        if (!rawToken) {
          logger.warn(`[Socket] No token provided: ${socket.id}`);
          return next(new Error("Authentication error: Token missing"));
        }

        const token = Array.isArray(rawToken) ? rawToken[0] : rawToken.replace('Bearer ', '');
        const decoded = jwt.verify(token, envConfig.JWT_ACCESS_SECRET!) as any;

        socket.data.user = {
          authId: decoded.authId,
        };

        logger.debug(`[Socket] Authorized: ${socket.data.user.authId} (${socket.id})`);
        next();

      } catch (error) {
        logger.error(`[Socket] Auth Failed: ${error}`);
        next(new Error("Authentication error: Invalid token"));
      }
    });
  }

  private initEvents() {
    this.io.on('connection', (socket: Socket) => {
      logger.info(`Client Connected: ${socket.id} (Total: ${this.io.engine.clientsCount})`);

      // 연결 해제 처리
      socket.on('disconnect', (reason) => {
        logger.info(`Client Disconnected: ${socket.id} (Reason: ${reason})`);
      });

      socket.on('error', (err) => {
        logger.error(`[Socket] Error from ${socket.id}:`, err);
      });
    });
  }
}
