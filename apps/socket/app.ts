import { Redis } from 'ioredis';
import { createServer, Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import {
  addUserToRoom,
  consumeConnToken,
  envConfig,
  getRoomMemberStates,
  getUserState,
  isValidChangeMapTarget,
  logger,
  persistUserStateFromRedisToDb,
  removeUserFromRoom,
  updateUserStateMap,
  updateUserStatePosition,
  deleteUserState,
  getGameTime,
} from '@poposerver/lib';

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

/** 소켓 연결 시 연결 토큰 검증 후 채워지고, init 이후 확장되는 데이터 */
export interface SocketData {
  /** handshake 시 세션 검증 후 추출 */
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

  constructor(private readonly redis: Redis) {
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

  private async authMiddleware(socket: Socket, next: (err?: Error) => void) {
    const token = socket.handshake.auth?.token;
    if (!token || typeof token !== 'string') {
      next(new Error('Missing connection token'));
      return;
    }

    const authId = await consumeConnToken(token);
    if (!authId) {
      next(new Error('Invalid or expired connection token'));
      return;
    }

    (socket.data as SocketData).authId = authId;
    next();
  }

  listen() {
    this.httpServer.listen(envConfig.SOCKET_PORT, () => {
      logger.info(`SOCKET Server is running on port ${envConfig.SOCKET_PORT}`);
    });
  }

  /** Redis kick 신호 수신 시 호출: targetSocketId가 있으면 해당 소켓만, 없으면 authId 전체 kick */
  kick(authId: string, targetSocketId?: string): void {
    if (targetSocketId) {
      const socket = this.io.sockets.sockets.get(targetSocketId);
      if (socket && (socket.data as SocketData).authId === authId) {
        socket.emit('kicked', { message: 'Logged in from another device.' });
        socket.disconnect(true);
        logger.info(`[Socket] kicked by API: ${socket.id} (authId: ${authId})`);
      }
      return;
    }

    for (const [, socket] of this.io.sockets.sockets) {
      if ((socket.data as SocketData).authId === authId) {
        socket.emit('kicked', { message: 'Logged in from another device.' });
        socket.disconnect(true);
        logger.info(`[Socket] kicked by API: ${socket.id} (authId: ${authId})`);
      }
    }
  }

  broadcastGameTime(timeOfDay: string): void {
    this.io.emit('game_time_changed', { timeOfDay });
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
    this.io.on('connection', async (socket: Socket) => {
      const data = socket.data as SocketData;
      logger.info(`Client connected: ${socket.id} (authId: ${data.authId})`);

      // connection 폴백 킥 (Pub/Sub 실패 시 안전망) + socketId 세팅
      if (data.authId) {
        const stateKey = `user:${data.authId}:state`;
        const existingState = await getUserState(data.authId);

        if (existingState && existingState.socketId && existingState.socketId !== socket.id) {
          const oldSocket = this.io.sockets.sockets.get(existingState.socketId);
          if (oldSocket) {
            oldSocket.emit('kicked', { message: 'Logged in from another device.' });
            oldSocket.disconnect(true);
            logger.info(
              `[Socket] connection fallback kick: ${existingState.socketId} (authId: ${data.authId})`,
            );
          }
        }

        if (existingState) {
          await this.redis.hset(stateKey, 'socketId', socket.id);
        }
      }

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
          if (!existingState) {
            socket.emit('init_error', {
              message: 'Game state not found. Please enter the game first.',
            });
            return;
          }

          // init 시점 킥 제거 — connection 핸들러에서 이미 처리됨

          const mapId = existingState.mapId;
          this.userPositions.set(authId, {
            x: Number(existingState.x),
            y: Number(existingState.y),
          });

          socket.join(mapId);
          await addUserToRoom(mapId, authId);
          logger.info(`[Socket] init addUserToRoom done: socketId=${socket.id}`);

          const roomStates = await getRoomMemberStates(mapId);
          socket.emit('init_room_state', { users: roomStates });

          socket.to(mapId).emit('user_joined', {
            userId: authId,
            mapId,
            x: existingState.x,
            y: existingState.y,
            nickname: existingState.nickname,
            costume: existingState.costume,
            gender: existingState.gender,
            pet: existingState.pet,
            lastMoveTime: existingState.lastMoveTime,
          });

          data.userId = authId;
          data.roomId = mapId;

          const gameTime = await getGameTime();
          socket.emit('init_ok', {
            userId: authId,
            nickname: existingState.nickname,
            gender: existingState.gender,
            lastLocation: {
              map: existingState.mapId,
              x: Number(existingState.x),
              y: Number(existingState.y),
            },
            timeOfDay: gameTime || 'day',
          });
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
        const { authId: disconnAuthId, userId, roomId } = data;

        // init 전(Title 등)에서 disconnect된 경우: user:state의 socketId만 정리
        if (!userId && disconnAuthId) {
          const currentState = await getUserState(disconnAuthId);
          if (currentState?.socketId === socket.id) {
            await this.redis.hset(`user:${disconnAuthId}:state`, 'socketId', '');
          }
        }

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

          // 소유권 확인: 현재 user:state의 socketId가 이 소켓인지 먼저 검사.
          // 킥된 소켓이면 socketId가 '' 또는 새 소켓 ID이므로 불일치 → state 보존.
          const currentState = await getUserState(userId);
          const isOwner = currentState?.socketId === socket.id;

          await persistUserStateFromRedisToDb(userId, { deleteFromRedis: isOwner });

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
