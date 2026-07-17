import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import {
  addSafariActive,
  addUserToRoom,
  Broadcaster,
  clearConnReservedGrace,
  clearUserStateSocketId,
  consumeConnToken,
  envConfig,
  extractPetState,
  getRoomMemberStates,
  getUserState,
  logger,
  persistUserStateFromRedisToDb,
  petChangeReqSchema,
  removeActivePlayer,
  removeUserFromRoom,
  setUserStateSocketId,
  setUserStateVisitedMaps,
  updateUserStateMap,
  updateUserStatePet,
  updateUserStatePosition,
  getGameTime,
  GameTimeState,
  getMapWeather,
  WeatherState,
  SafariWild,
  SafariItem,
  WildDespawnReason,
  removeSafariActive,
  snapshotWilds,
  snapshotItems,
  shouldSyncOtherPlayers,
  auditAsync,
  AuditAction,
  MasterData,
} from '@poposerver/lib';
import { ensureSafariBucket } from '../api/domains/game/safari-world';

/** init_ok / change_map_ok에 실리는 사파리 스냅샷(클라 렌더 재조정의 권위 소스). */
type SafariSnapshot = { wilds: SafariWild[]; items: SafariItem[] };

function socketIp(socket: Socket): string | null {
  const fwd = socket.handshake.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0].trim();
  if (Array.isArray(fwd) && fwd.length > 0) return fwd[0];
  return socket.handshake.address || null;
}

const MOVE_DIRECTIONS = ['up', 'down', 'left', 'right'] as const;
type MoveDirection = (typeof MOVE_DIRECTIONS)[number];

export const MOVE_TYPES = ['walk', 'running', 'ride', 'surf', 'jump'] as const;
export type MoveType = (typeof MOVE_TYPES)[number];

const TICK_RATE_MS = 33;

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

export class SocketApp implements Broadcaster {
  private io: SocketIOServer;

  /** [Tick 시스템] 맵(roomId)별 → 유저별 이동 버퍼. 틱마다 한 번에 브로드캐스트 후 비움 */
  private moveBuffer: Map<string, Map<string, MoveBufferEntry>> = new Map();
  private tickInterval: NodeJS.Timeout | null = null;

  /** In-memory 좌표 캐시: userId → { x, y }. move 핸들러에서 await 없이 좌표 업데이트 */
  private userPositions: Map<string, { x: number; y: number }> = new Map();
  // private tickSeq = 0;

  constructor(httpServer: HttpServer) {
    this.io = new SocketIOServer(httpServer, {
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
        if (shouldSyncOtherPlayers(roomId)) {
          const updates = Array.from(usersMap.entries()).map(([userId, entry]) => ({
            userId,
            ...entry,
          }));
          this.io.to(roomId).emit('users_moved', { updates });
        }
        await this.syncPositionsToState(usersMap);
        usersMap.clear();
      }
    }, TICK_RATE_MS);
  }

  private async syncPositionsToState(usersMap: Map<string, MoveBufferEntry>): Promise<void> {
    for (const [userId, entry] of usersMap) {
      await updateUserStatePosition(userId, {
        x: String(entry.x),
        y: String(entry.y),
        lastMoveTime: entry.lastMoveTime,
      });
    }
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

  broadcastMaintenance(): void {
    const total = this.io.sockets.sockets.size;
    logger.info(`[Socket] broadcasting maintenance to ${total} active sockets`);
    for (const [, socket] of this.io.sockets.sockets) {
      socket.emit('kicked', { reason: 'MAINTENANCE' });
      socket.disconnect(true);
    }
  }

  broadcastGameTime(state: GameTimeState): void {
    this.io.emit('game_time_changed', {
      timeOfDay: state.phase,
      startedAt: state.startedAt,
      duration: state.duration,
    });
  }

  broadcastWeather(state: WeatherState): void {
    const payload = {
      mapId: state.mapId,
      weather: state.weather,
      startedAt: state.startedAt,
      duration: state.duration,
    };
    for (const [, socket] of this.io.sockets.sockets) {
      if ((socket.data as SocketData).roomId === state.mapId) {
        socket.emit('weather_changed', payload);
      }
    }
  }

  private emitToAuthInRoom(authId: string, mapId: string, event: string, payload: unknown): void {
    for (const [, socket] of this.io.sockets.sockets) {
      const d = socket.data as SocketData;
      if (d.authId === authId && d.roomId === mapId) {
        socket.emit(event, payload);
      }
    }
  }

  private emitToAuthAllRooms(authId: string, event: string, payload: unknown): void {
    for (const [, socket] of this.io.sockets.sockets) {
      const d = socket.data as SocketData;
      if (d.authId === authId) {
        socket.emit(event, payload);
      }
    }
  }

  emitWildSpawn(authId: string, mapId: string, wild: SafariWild): void {
    this.emitToAuthInRoom(authId, mapId, 'wild:spawn', { mapId, wild });
  }

  emitWildDespawn(authId: string, mapId: string, wildUid: string, reason: WildDespawnReason): void {
    this.emitToAuthAllRooms(authId, 'wild:despawn', { mapId, wildUid, reason });
  }

  async close() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    this.io.disconnectSockets(true);
  }

  private initEvents() {
    this.io.on('connection', (socket: Socket) => {
      const data = socket.data as SocketData;
      logger.info(`Client connected: ${socket.id} (authId: ${data.authId})`);

      if (data.authId) {
        const authId = data.authId;
        void (async () => {
          // 핸드셰이크 성공 → 슬롯 grace 종료. janitor가 stale로 판정하지 않게 한다.
          await clearConnReservedGrace(authId);

          const existingState = await getUserState(authId);

          if (existingState && existingState.socketId && existingState.socketId !== socket.id) {
            const oldSocket = this.io.sockets.sockets.get(existingState.socketId);
            if (oldSocket) {
              oldSocket.emit('kicked', { message: 'Logged in from another device.' });
              oldSocket.disconnect(true);
              logger.info(
                `[Socket] connection fallback kick: ${existingState.socketId} (authId: ${authId})`,
              );
            }
          }

          if (existingState) {
            await setUserStateSocketId(authId, socket.id);
          }
        })().catch((err) => {
          logger.error(`[Socket] connection fallback failed: socketId=${socket.id}`, err);
        });
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

          const syncOthers = shouldSyncOtherPlayers(mapId);

          if (syncOthers) {
            socket.join(mapId);
            await addUserToRoom(mapId, authId);
          }

          if (mapId.startsWith('s')) {
            await addSafariActive(authId, mapId);
            await ensureSafariBucket(authId, mapId);
          }
          logger.info(`[Socket] init addUserToRoom done: socketId=${socket.id}`);

          const roomStates = syncOthers ? await getRoomMemberStates(mapId) : [];
          socket.emit('init_room_state', {
            users: roomStates.map((s) => ({ ...s, pet: extractPetState(s) })),
          });

          if (syncOthers) {
            socket.to(mapId).emit('user_joined', {
              userId: authId,
              mapId,
              x: existingState.x,
              y: existingState.y,
              nickname: existingState.nickname,
              costume: existingState.costume,
              gender: existingState.gender,
              pet: extractPetState(existingState),
              lastMoveTime: existingState.lastMoveTime,
            });
          }

          data.userId = authId;
          data.roomId = mapId;

          const gameTime = await getGameTime();
          const weather = await getMapWeather(mapId);
          const safari: SafariSnapshot | undefined = mapId.startsWith('s')
            ? { wilds: snapshotWilds(authId, mapId), items: snapshotItems(authId, mapId) }
            : undefined;
          socket.emit('init_ok', {
            userId: authId,
            nickname: existingState.nickname,
            gender: existingState.gender,
            lastLocation: {
              map: existingState.mapId,
              x: Number(existingState.x),
              y: Number(existingState.y),
            },
            timeOfDay: gameTime?.phase ?? 'day',
            gameTimeStartedAt: gameTime?.startedAt,
            gameTimeDuration: gameTime?.duration,
            weather: weather?.weather ?? 'sunny',
            weatherStartedAt: weather?.startedAt,
            weatherDuration: weather?.duration,
            safari,
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

        let x = typeof payload?.x === 'number' ? payload.x : Number(payload?.x);
        let y = typeof payload?.y === 'number' ? payload.y : Number(payload?.y);
        if (Number.isNaN(x) || Number.isNaN(y)) {
          socket.emit('change_map_error', { message: 'Invalid spawn coordinates' });
          return;
        }

        if ((payload as { fly?: boolean })?.fly === true && targetMapId.startsWith('s')) {
          const entry = MasterData.getMap(targetMapId)?.entry;
          if (entry) {
            x = entry.x;
            y = entry.y;
          }
        }

        // if (!isValidChangeMapTarget(targetMapId, x, y)) {
        //   socket.emit('change_map_error', { message: 'Spawn position not allowed' });
        //   return;
        // }

        try {
          const syncFromOthers = shouldSyncOtherPlayers(roomId);
          const syncToOthers = shouldSyncOtherPlayers(targetMapId);

          if (syncFromOthers) {
            await removeUserFromRoom(roomId, userId);
            socket.leave(roomId);
            this.io.to(roomId).emit('user_left', { userId });
          }

          if (roomId.startsWith('s')) {
            await removeSafariActive(userId, roomId);
          }

          const now = new Date().toISOString();
          await updateUserStateMap(userId, {
            mapId: targetMapId,
            x: String(x),
            y: String(y),
            lastMoveTime: now,
          });
          this.userPositions.set(userId, { x, y });

          if (syncToOthers) {
            socket.join(targetMapId);
            await addUserToRoom(targetMapId, userId);
          }
          data.roomId = targetMapId;

          if (targetMapId.startsWith('s')) {
            await addSafariActive(userId, targetMapId);
            await ensureSafariBucket(userId, targetMapId);
          }

          const roomStates = syncToOthers ? await getRoomMemberStates(targetMapId) : [];
          socket.emit('init_room_state', {
            users: roomStates.map((s) => ({ ...s, pet: extractPetState(s) })),
          });

          const state = await getUserState(userId);

          if (state && targetMapId.startsWith('s')) {
            const visited: string[] = state.visitedMaps ? JSON.parse(state.visitedMaps) : [];
            if (!visited.includes(targetMapId)) {
              visited.push(targetMapId);
              await setUserStateVisitedMaps(userId, JSON.stringify(visited));
            }
          }

          if (syncToOthers) {
            const userJoinedPayload = state
              ? {
                  userId,
                  mapId: targetMapId,
                  x: String(x),
                  y: String(y),
                  nickname: state.nickname,
                  costume: state.costume,
                  gender: state.gender,
                  pet: extractPetState(state),
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
                  pet: null,
                  lastMoveTime: now,
                };
            socket.to(targetMapId).emit('user_joined', userJoinedPayload);
          }

          const weather = await getMapWeather(targetMapId);
          const safari: SafariSnapshot | undefined = targetMapId.startsWith('s')
            ? {
                wilds: snapshotWilds(userId, targetMapId),
                items: snapshotItems(userId, targetMapId),
              }
            : undefined;
          socket.emit('change_map_ok', {
            mapId: targetMapId,
            x,
            y,
            weather: weather?.weather ?? 'sunny',
            weatherStartedAt: weather?.startedAt,
            weatherDuration: weather?.duration,
            safari,
          });
          logger.info(`[Socket] change_map: ${userId} -> ${targetMapId} (${x},${y})`);

          void auditAsync({
            accountId: Number(userId),
            action: AuditAction.MAP_CHANGE,
            detail: { from: roomId, to: targetMapId, x, y },
            ip: socketIp(socket),
            source: 'socket',
          });
        } catch (error) {
          logger.error('[Socket] change_map failed:', error);
          socket.emit('change_map_error', { message: 'Change map failed' });
        }
      });

      socket.on('pet-change', async (payload: unknown) => {
        const userId = data.userId;
        const roomId = data.roomId;
        if (!userId || !roomId) return;

        const parsed = petChangeReqSchema.safeParse(payload);
        if (!parsed.success) {
          logger.warn(
            `[Socket] pet-change invalid payload from ${userId}: ${parsed.error.message}`,
          );
          return;
        }

        const { pokedexId, isShiny } = parsed.data;

        try {
          await updateUserStatePet(userId, { pokedexId, isShiny });
          if (shouldSyncOtherPlayers(roomId)) {
            socket.to(roomId).emit('other-pet-change', {
              userId,
              pokedexId,
              isShiny,
            });
          }

          // PET_CHANGE audit는 일단 보류 (펫 변경 빈도가 높아 audit 노이즈 우려). 필요 시 활성화.
          // void auditAsync({
          //   accountId: Number(userId),
          //   action: AuditAction.PET_CHANGE,
          //   detail: { pokedexId, isShiny, mapId: roomId },
          //   ip: socketIp(socket),
          //   source: 'socket',
          // });
        } catch (error) {
          logger.error(`[Socket] pet-change failed userId=${userId}:`, error);
        }
      });

      socket.on('disconnect', async (reason) => {
        logger.info(`Client disconnected: ${socket.id} (Reason: ${reason})`);
        const { authId: disconnAuthId, userId, roomId } = data;

        if (!userId && disconnAuthId) {
          const currentState = await getUserState(disconnAuthId);
          if (currentState?.socketId === socket.id) {
            await clearUserStateSocketId(disconnAuthId);
          }
        }

        if (userId) {
          if (roomId && this.moveBuffer.has(roomId)) {
            this.moveBuffer.get(roomId)!.delete(userId);
          }

          const currentState = await getUserState(userId);
          const isOwner = currentState?.socketId === socket.id;

          const pos = this.userPositions.get(userId);
          if (pos && isOwner && currentState?.mapId === roomId) {
            await updateUserStatePosition(userId, {
              x: String(pos.x),
              y: String(pos.y),
              lastMoveTime: new Date().toISOString(),
            });
          }
          this.userPositions.delete(userId);

          await persistUserStateFromRedisToDb(userId, { deleteFromRedis: isOwner });

          if (isOwner) {
            // 슬롯 회수. ownership 가드를 통과한 경우에만 — 킥당한 소켓이 SREM하면
            // 같은 authId의 새 연결까지 영향받기 때문.
            await removeActivePlayer(userId);
          }

          if (roomId) {
            if (shouldSyncOtherPlayers(roomId)) {
              await removeUserFromRoom(roomId, userId);
              this.io.to(roomId).emit('user_left', { userId });
            }
            if (roomId.startsWith('s')) {
              await removeSafariActive(userId, roomId);
            }
          }
        }
      });

      socket.on('error', (err) => {
        logger.error(`[Socket] Error from ${socket.id}:`, err);
      });
    });
  }
}
