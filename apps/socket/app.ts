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

const MOVE_DIRECTIONS = ['up', 'down', 'left', 'right'] as const;
type MoveDirection = (typeof MOVE_DIRECTIONS)[number];

export const MOVE_TYPES = ['walk', 'running', 'ride', 'surf', 'jump'] as const;
export type MoveType = (typeof MOVE_TYPES)[number];

/** Tick 시스템: 이동 브로드캐스트를 이 주기(ms)마다 묶어서 전송. 20Hz = 최대 약 50ms 지연 */
const TICK_RATE_MS = 50;

/** Tick 버퍼에 담기는 이동 데이터 (users_moved 이벤트 payload와 동일한 필드) */
export interface MoveBufferEntry {
  x: number;
  y: number;
  direction: MoveDirection;
  moveType: MoveType;
  lastMoveTime: string;
}

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

  /** [Tick 시스템] 맵(roomId)별 → 유저별 이동 버퍼. 틱마다 한 번에 브로드캐스트 후 비움 */
  private moveBuffer: Map<string, Map<string, MoveBufferEntry>> = new Map();
  private tickInterval: NodeJS.Timeout | null = null;

  /** In-memory 좌표 캐시: userId → { x, y }. move 핸들러에서 await 없이 좌표 업데이트 */
  private userPositions: Map<string, { x: number; y: number }> = new Map();
  // private tickSeq = 0;

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
    this.startTickLoop();
  }

  /**
   * [Tick] TICK_RATE_MS마다 각 방의 버퍼를 모아 users_moved로 한 번에 브로드캐스트 후
   * 변경된 좌표를 Redis에 일괄 기록 (pipeline).
   */
  private startTickLoop(): void {
    this.tickInterval = setInterval(async () => {
      for (const [roomId, usersMap] of this.moveBuffer) {
        if (usersMap.size === 0) continue;
        const updates = Array.from(usersMap.entries()).map(([userId, entry]) => ({
          userId,
          ...entry,
        }));
        this.io.to(roomId).emit('users_moved', { updates });
        await this.syncPositionsToRedis(usersMap);
        usersMap.clear();
      }
    }, TICK_RATE_MS);
  }

  /** 버퍼에 있는 유저 좌표를 Redis에 pipeline으로 일괄 기록 */
  private async syncPositionsToRedis(usersMap: Map<string, MoveBufferEntry>): Promise<void> {
    const pipeline = this.redis.pipeline();
    for (const [userId, entry] of usersMap) {
      const key = `user:${userId}:state`;
      pipeline.hset(
        key,
        'x',
        String(entry.x),
        'y',
        String(entry.y),
        'lastMoveTime',
        entry.lastMoveTime,
      );
    }
    await pipeline.exec();
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
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
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
        logger.info(`[Socket] init start: socketId=${socket.id} authId=${authId ?? 'missing'}`);
        if (!authId) {
          socket.emit('init_error', { message: 'Not authenticated' });
          return;
        }

        try {
          const existingState = await getUserState(authId);
          logger.info(`[Socket] init existingState done: socketId=${socket.id}`);
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
          logger.info(`[Socket] init user lookup done: socketId=${socket.id} userFound=${!!user}`);
          if (!user) {
            logger.warn(`[Socket] init abort: user not found authId=${authId}`);
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
          this.userPositions.set(authId, { x: Number(x), y: Number(y) });
          logger.info(`[Socket] init setUserState done: socketId=${socket.id} mapId=${mapId}`);

          socket.join(mapId);
          await addUserToRoom(mapId, authId);
          logger.info(`[Socket] init addUserToRoom done: socketId=${socket.id}`);

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

          logger.info(`[Socket] init about to set userId/roomId: socketId=${socket.id}`);
          data.userId = authId;
          data.roomId = mapId;
          socket.emit('init_ok', { userId: authId, nickname, gender, lastLocation });
          logger.info(`[Socket] init success: ${socket.id} userId=${authId}`);
        } catch (error) {
          logger.error(`[Socket] init failed: socketId=${socket.id} authId=${authId}`, error);
          socket.emit('init_error', { message: 'Init failed' });
        }
      });

      socket.on('move', (payload: { direction?: string; moveType?: string } | string) => {
        const userId = data.userId;
        const roomId = data.roomId;
        if (!userId || !roomId) return;

        let parsed: { direction?: string; moveType?: string };
        if (typeof payload === 'string') {
          try {
            parsed = JSON.parse(payload) as { direction?: string; moveType?: string };
          } catch {
            return;
          }
        } else {
          parsed = payload ?? {};
        }

        const direction = parsed?.direction;
        if (!direction || !MOVE_DIRECTIONS.includes(direction as MoveDirection)) return;

        const moveType =
          parsed?.moveType && MOVE_TYPES.includes(parsed.moveType as MoveType)
            ? (parsed.moveType as MoveType)
            : 'walk';

        const pos = this.userPositions.get(userId) ?? { x: 0, y: 0 };
        const step = moveType === 'jump' ? 2 : 1;
        switch (direction as MoveDirection) {
          case 'up':
            pos.y -= step;
            break;
          case 'down':
            pos.y += step;
            break;
          case 'left':
            pos.x -= step;
            break;
          case 'right':
            pos.x += step;
            break;
        }
        this.userPositions.set(userId, pos);

        const now = new Date().toISOString();
        if (!this.moveBuffer.has(roomId)) this.moveBuffer.set(roomId, new Map());
        this.moveBuffer.get(roomId)!.set(userId, {
          x: pos.x,
          y: pos.y,
          direction: direction as MoveDirection,
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
          this.userPositions.set(userId, { x, y });

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
          if (roomId && this.moveBuffer.has(roomId)) {
            this.moveBuffer.get(roomId)!.delete(userId);
          }
          const pos = this.userPositions.get(userId);
          if (pos) {
            await updateUserStatePosition(userId, {
              x: String(pos.x),
              y: String(pos.y),
              lastMoveTime: new Date().toISOString(),
            });
            this.userPositions.delete(userId);
          }
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
