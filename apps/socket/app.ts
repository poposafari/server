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
  loadtestMetrics,
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

    loadtestMetrics.start();
    loadtestMetrics.setRoomProvider(() => this.roomSizes());

    if (envConfig.MOVE_BROADCAST_MODE === 'tick') {
      this.startTickLoop();
    }
    logger.info(
      `[Socket] move broadcast mode = ${envConfig.MOVE_BROADCAST_MODE} (tick ${envConfig.TICK_RATE_MS}ms), loadtest metrics = ${envConfig.LOADTEST_METRICS}`,
    );
  }

  /**
   * [Tick] TICK_RATE_MS마다 각 방의 버퍼를 모아 users_moved로 한 번에 브로드캐스트 후
   * 변경된 좌표를 Redis에 일괄 기록 (pipeline).
   */
  private startTickLoop(): void {
    this.tickInterval = setInterval(async () => {
      const startedAt = performance.now();
      let nonEmpty = false;
      for (const [roomId, usersMap] of this.moveBuffer) {
        if (usersMap.size === 0) continue;
        nonEmpty = true;
        if (shouldSyncOtherPlayers(roomId)) {
          const updates = Array.from(usersMap.entries()).map(([userId, entry]) => ({
            userId,
            ...entry,
          }));
          this.io.to(roomId).emit('users_moved', { updates });
          loadtestMetrics.countEmit(updates.length);
        }
        await this.syncPositionsToState(usersMap);
        usersMap.clear();
      }
      loadtestMetrics.countTick(nonEmpty, performance.now() - startedAt);
    }, envConfig.TICK_RATE_MS);
  }

  /** 계측용 — 소켓 id 방(자기 자신 방)을 제외한 실제 맵 방의 인원 수 */
  private roomSizes(): { sockets: number; rooms: Record<string, number> } {
    const rooms: Record<string, number> = {};
    for (const [roomId, members] of this.io.sockets.adapter.rooms) {
      if (this.io.sockets.sockets.has(roomId)) continue;
      rooms[roomId] = members.size;
    }
    return { sockets: this.io.sockets.sockets.size, rooms };
  }

  /**
   * [tick 모드] 이동을 방별 버퍼에 덮어쓴다. 같은 틱 안의 연속 이동은 마지막 것만 남는다.
   * 실제 emit/state 반영은 startTickLoop이 담당.
   */
  private dispatchMoveBuffered(roomId: string, userId: string, entry: MoveBufferEntry): void {
    if (!this.moveBuffer.has(roomId)) this.moveBuffer.set(roomId, new Map());
    this.moveBuffer.get(roomId)!.set(userId, entry);
  }

  /**
   * [immediate 모드] 틱 도입 전 동작 재현 — move 이벤트 수신 즉시 해당 방에 브로드캐스트하고
   * 좌표를 state에 기록한다. payload 형태는 tick 모드와 동일(updates 배열, 길이 1)이라
   * 클라이언트는 수정 없이 그대로 동작한다.
   */
  private dispatchMoveImmediate(roomId: string, userId: string, entry: MoveBufferEntry): void {
    if (shouldSyncOtherPlayers(roomId)) {
      this.io.to(roomId).emit('users_moved', { updates: [{ userId, ...entry }] });
      loadtestMetrics.countEmit(1);
    }
    void updateUserStatePosition(userId, {
      x: String(entry.x),
      y: String(entry.y),
      lastMoveTime: entry.lastMoveTime,
    }).catch((err) =>
      logger.error(`[Socket] immediate position sync failed userId=${userId}`, err),
    );
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

          let kickedPrevious = false;
          if (existingState && existingState.socketId && existingState.socketId !== socket.id) {
            const oldSocket = this.io.sockets.sockets.get(existingState.socketId);
            if (oldSocket) {
              oldSocket.emit('kicked', { message: 'Logged in from another device.' });
              oldSocket.disconnect(true);
              kickedPrevious = true;
              logger.info(
                `[Socket] connection fallback kick: ${existingState.socketId} (authId: ${authId})`,
              );
            }
          }

          if (existingState) {
            await setUserStateSocketId(authId, socket.id);
          }

          // SOCKET_DISCONNECT와 짝을 이뤄 세션 길이를 계산한다.
          // 기록 시점은 핸드셰이크 성공 직후(init 성공 여부와 무관) — disconnect도 같은 범위를
          // 커버하므로 두 이벤트의 모수가 일치한다.
          void auditAsync({
            accountId: Number(authId),
            action: AuditAction.SOCKET_CONNECT,
            detail: {
              socketId: socket.id,
              mapId: existingState?.mapId ?? null,
              // false면 /game/connect가 만든 state가 없는 상태로 붙은 것 → init이 실패한다.
              hasState: !!existingState,
              // true면 같은 계정의 이전 연결을 밀어내고 들어온 접속(다중 로그인).
              kickedPrevious,
            },
            ip: socketIp(socket),
            source: 'socket',
          });
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
            await ensureSafariBucket(authId, mapId, 'socket', socketIp(socket));
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
        loadtestMetrics.countMove();

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

        const entry: MoveBufferEntry = {
          x: pos.x,
          y: pos.y,
          direction: direction as MoveDirection,
          moveType,
          lastMoveTime: new Date().toISOString(),
        };

        if (envConfig.MOVE_BROADCAST_MODE === 'immediate') {
          this.dispatchMoveImmediate(roomId, userId, entry);
        } else {
          this.dispatchMoveBuffered(roomId, userId, entry);
        }
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
            await ensureSafariBucket(userId, targetMapId, 'socket', socketIp(socket));
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
        let ownedSlot: boolean | null = null;

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
          ownedSlot = isOwner;

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

        const auditAuthId = userId ?? disconnAuthId;
        if (auditAuthId) {
          void auditAsync({
            accountId: Number(auditAuthId),
            action: AuditAction.SOCKET_DISCONNECT,
            detail: {
              reason,
              socketId: socket.id,
              mapId: roomId ?? null,
              // ownedSlot = 이 disconnect가 "현재 살아있는 세션"의 종료인지 여부.
              //   user state의 socketId는 "이 계정의 진짜 연결은 이 소켓"이라는 표식이다.
              //   같은 계정이 다른 기기로 접속하면 connection 핸들러가 옛 소켓을 킥하고
              //   socketId를 새 소켓 id로 덮어쓴다. 그 뒤 킥당한 옛 소켓의 disconnect가
              //   뒤늦게 도착하면 socketId는 이미 새 소켓 → isOwner=false가 된다.
              //   true  = 정상 이탈(창 닫기 / 네트워크 끊김 / 로그아웃)
              //   false = 다중 로그인으로 킥당한 옛 연결의 뒷정리
              //           (이 경우 슬롯 회수를 하면 방금 접속한 새 세션이 죽는다)
              //   null  = 계산 자체를 안 함(= initialized false)
              ownedSlot,
              // initialized = init 이벤트가 끝까지 성공했는지 여부.
              //   authId는 핸드셰이크(연결 토큰 검증)에서, userId는 init 성공 끝에서 세팅된다.
              //   true  = 게임에 정상 입장한 뒤 끊김
              //   false = 핸드셰이크만 통과하고 init 전에 끊김(로딩 중 이탈 / init 실패)
              initialized: !!userId,
            },
            ip: socketIp(socket),
            source: 'socket',
          });
        }
      });

      socket.on('error', (err) => {
        logger.error(`[Socket] Error from ${socket.id}:`, err);
      });
    });
  }
}
