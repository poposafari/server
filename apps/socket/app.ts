import { Redis } from 'ioredis';
import { DataSource } from 'typeorm';
import {
  envConfig,
  logger,
  verifyToken,
  getUserState,
  setUserState,
  updateUserStatePosition,
  updateUserStateMap,
  addUserToRoom,
  removeUserFromRoom,
  getRoomMemberStates,
  persistUserStateFromRedisToDb,
  isValidChangeMapTarget,
  User,
  UserStartLocation,
} from '@poposerver/shared';
import { createServer, Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';

const MOVE_DURATION_MS = 90;
const MOVE_DIRECTIONS = ['up', 'down', 'left', 'right'] as const;
type MoveDirection = (typeof MOVE_DIRECTIONS)[number];

export const MOVE_TYPES = ['walk', 'running', 'ride', 'surf', 'jump'] as const;
export type MoveType = (typeof MOVE_TYPES)[number];

/** 소켓 연결 시 handshake.auth.token(AT)으로 한 번 검증 후 채워지고, init 이후 확장되는 데이터 */
export interface SocketData {
  /** handshake 시 access token 검증 후 추출 */
  authId?: string;
  userId?: string;
  roomId?: string;
}

export class SocketApp {
  private httpServer: HttpServer;
  private io: SocketIOServer;

  constructor(
    private readonly redis: Redis,
    private readonly dataSource: DataSource,
  ) {
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

    this.io.use(this.authMiddleware.bind(this));
    this.initEvents();
  }

  private authMiddleware(socket: Socket, next: (err?: Error) => void) {
    const authToken =
      (typeof socket.handshake.auth?.token === 'string' && socket.handshake.auth.token) ||
      (Array.isArray(socket.handshake.auth?.token) ? socket.handshake.auth.token[0] : undefined);
    const queryToken =
      typeof socket.handshake.query?.token === 'string'
        ? socket.handshake.query.token
        : Array.isArray(socket.handshake.query?.token)
          ? socket.handshake.query.token[0]
          : undefined;
    const token = authToken || queryToken;
    if (!token) {
      next(new Error('Missing access token'));
      return;
    }
    const payload = verifyToken('access', token);
    if (!payload) {
      next(new Error('Invalid access token'));
      return;
    }
    (socket.data as SocketData).authId = payload.authId;
    next();
  }

  listen() {
    this.httpServer.listen(envConfig.SOCKET_PORT, () => {
      logger.info(`SOCKET Server is running on port ${envConfig.SOCKET_PORT}`);
    });
  }

  /** Redis kick 신호 수신 시 호출: 해당 authId 소켓에 kicked emit 후 disconnect */
  async kickByAuthId(authId: string): Promise<void> {
    const state = await getUserState(authId);
    if (!state?.socketId) return;
    const oldSocket = this.io.sockets.sockets.get(state.socketId);
    if (oldSocket) {
      oldSocket.emit('kicked', { message: 'Logged in from another device.' });
      oldSocket.disconnect(true);
      logger.info(`[Socket] kicked by API: ${state.socketId} (authId: ${authId})`);
    }
  }

  async close() {
    return new Promise<void>((resolve, reject) => {
      this.io.close(() => {
        this.httpServer.close((err: any) => {
          if (err) return reject(err);
          resolve();
        });
      });
    });
  }

  private initEvents() {
    this.io.on('connection', (socket: Socket) => {
      const data = socket.data as SocketData;
      logger.info(`Client connected: ${socket.id} (authId: ${data.authId})`);

      socket.on('init', async () => {
        const authId = data.authId;
        if (!authId) {
          socket.emit('init_error', { message: 'Not authenticated' });
          return;
        }

        try {
          const existingState = await getUserState(authId);
          if (existingState?.socketId && existingState.socketId !== socket.id) {
            const oldSocket = this.io.sockets.sockets.get(existingState.socketId);
            if (oldSocket) {
              oldSocket.emit('kicked', { message: 'Logged in from another device.' });
              oldSocket.disconnect(true);
              logger.info(
                `[Socket] kicked previous session: ${existingState.socketId} (authId: ${authId})`,
              );
            }
          }

          const userRepo = this.dataSource.getRepository(User);
          const user = await userRepo.findOne({
            where: { authId },
            select: ['nickname', 'gender', 'lastLocation', 'lastCostume'],
          });
          if (!user) {
            socket.emit('init_error', { message: 'User not found' });
            return;
          }
          const { nickname, gender, lastLocation, lastCostume } = user;

          const now = new Date().toISOString();
          const mapId = lastLocation?.map ?? UserStartLocation.map;
          const x = String(lastLocation?.x ?? UserStartLocation.x);
          const y = String(lastLocation?.y ?? UserStartLocation.y);

          await setUserState(authId, {
            mapId,
            x,
            y,
            nickname,
            costume: JSON.stringify(lastCostume),
            socketId: socket.id,
            gender,
            pet: '',
            createdAt: now,
            lastMoveTime: now,
          });

          socket.join(mapId);
          await addUserToRoom(mapId, authId);

          const roomStates = await getRoomMemberStates(mapId);
          socket.emit('init_room_state', { users: roomStates });

          const userJoinedPayload = {
            userId: authId,
            mapId,
            x,
            y,
            nickname,
            costume: JSON.stringify(lastCostume),
            gender,
            pet: '',
            lastMoveTime: now,
          };
          socket.to(mapId).emit('user_joined', userJoinedPayload);

          data.userId = authId;
          data.roomId = mapId;
          socket.emit('init_ok', { userId: authId, nickname, gender, lastLocation });
          logger.info(`[Socket] init success: ${socket.id} userId=${authId}`);
        } catch (error) {
          logger.error('[Socket] init failed:', error);
          socket.emit('init_error', { message: 'Init failed' });
        }
      });

      socket.on('move', async (payload: { direction?: string; moveType?: string }) => {
        const userId = data.userId;
        const roomId = data.roomId;
        if (!userId || !roomId) return;

        const direction = payload?.direction;
        if (!direction || !MOVE_DIRECTIONS.includes(direction as MoveDirection)) return;

        const moveType =
          payload?.moveType && MOVE_TYPES.includes(payload.moveType as MoveType)
            ? (payload.moveType as MoveType)
            : 'walk';

        const state = await getUserState(userId);
        if (!state) return;

        const nowMs = Date.now();
        const lastMoveMs = new Date(state.lastMoveTime).getTime();
        if (nowMs - lastMoveMs < MOVE_DURATION_MS) return;

        let curX = Number(state.x);
        let curY = Number(state.y);
        if (Number.isNaN(curX)) curX = 0;
        if (Number.isNaN(curY)) curY = 0;

        const step = moveType === 'jump' ? 2 : 1;
        switch (direction as MoveDirection) {
          case 'up':
            curY -= step;
            break;
          case 'down':
            curY += step;
            break;
          case 'left':
            curX -= step;
            break;
          case 'right':
            curX += step;
            break;
        }

        // TODO: 나중에 지형/지물 충돌 체크 로직을 추가하자. (맵 타일 데이터로 벽 체크)
        const now = new Date().toISOString();
        await updateUserStatePosition(userId, {
          x: String(curX),
          y: String(curY),
          lastMoveTime: now,
        });
        this.io.to(roomId).emit('user_moved', {
          userId,
          x: curX,
          y: curY,
          direction,
          moveType,
          lastMoveTime: now,
        });
      });

      socket.on('change_map', async (payload: { targetMapId?: string; x?: number; y?: number }) => {
        const userId = data.userId;
        const roomId = data.roomId;
        if (!userId || !roomId) {
          socket.emit('change_map_error', { message: 'Not initialized' });
          return;
        }

        const targetMapId = payload?.targetMapId;
        if (!targetMapId || targetMapId === roomId) {
          socket.emit('change_map_error', { message: 'Invalid target map' });
          return;
        }

        const x = typeof payload?.x === 'number' ? payload.x : Number(payload?.x);
        const y = typeof payload?.y === 'number' ? payload.y : Number(payload?.y);
        if (Number.isNaN(x) || Number.isNaN(y)) {
          socket.emit('change_map_error', { message: 'Invalid spawn coordinates' });
          return;
        }

        if (!isValidChangeMapTarget(targetMapId, x, y)) {
          socket.emit('change_map_error', { message: 'Spawn position not allowed' });
          return;
        }

        try {
          await removeUserFromRoom(roomId, userId);
          socket.leave(roomId);
          this.io.to(roomId).emit('user_left', { userId });

          const now = new Date().toISOString();
          await updateUserStateMap(userId, {
            mapId: targetMapId,
            x: String(x),
            y: String(y),
            lastMoveTime: now,
          });

          socket.join(targetMapId);
          await addUserToRoom(targetMapId, userId);
          data.roomId = targetMapId;

          const roomStates = await getRoomMemberStates(targetMapId);
          socket.emit('init_room_state', { users: roomStates });

          const state = await getUserState(userId);
          const userJoinedPayload = state
            ? {
                userId,
                mapId: targetMapId,
                x: String(x),
                y: String(y),
                nickname: state.nickname,
                costume: state.costume,
                gender: state.gender,
                pet: state.pet,
                lastMoveTime: now,
              }
            : {
                userId,
                mapId: targetMapId,
                x: String(x),
                y: String(y),
                nickname: '',
                costume: '',
                gender: '',
                pet: '',
                lastMoveTime: now,
              };
          socket.to(targetMapId).emit('user_joined', userJoinedPayload);

          socket.emit('change_map_ok', { mapId: targetMapId, x, y });
          logger.info(`[Socket] change_map: ${userId} -> ${targetMapId} (${x},${y})`);
        } catch (error) {
          logger.error('[Socket] change_map failed:', error);
          socket.emit('change_map_error', { message: 'Change map failed' });
        }
      });

      socket.on('disconnect', async (reason) => {
        logger.info(`Client disconnected: ${socket.id} (Reason: ${reason})`);
        const { userId, roomId } = data;
        if (userId) {
          await persistUserStateFromRedisToDb(userId, this.dataSource);
          if (roomId) {
            await removeUserFromRoom(roomId, userId);
            this.io.to(roomId).emit('user_left', { userId });
          }
        }
      });

      socket.on('error', (err) => {
        logger.error(`[Socket] Error from ${socket.id}:`, err);
      });
    });
  }
}
