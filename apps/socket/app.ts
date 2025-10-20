import { Server, Socket } from 'socket.io';
import { parseAccessToken } from './auth';

type Player = {
  location: string | null;
  x: number | null;
  y: number | null;
  nickname: string | null;
  avatar: number | null;
  facing: 'up' | 'down' | 'left' | 'right';
  pet: Pet | null;
  gender: 'boy' | 'girl' | null;
  option: PlayerOption;
  pc: PcData;
};

type PlayerOption = {
  textSpeed: number | null;
  frame: number | null;
  backgroundVolume: number | null;
  effectVolume: number | null;
};

type PcData = {
  bgs: number[];
  names: string[];
};

type Pet = {
  idx: number;
  texture: string | null;
};

type MoveLocation = {
  from: string | null;
  to: string;
  toX: number;
  toY: number;
};

type MovementPlayer = {
  x: number;
  y: number;
  direction: 'up' | 'down' | 'left' | 'right';
  petDirection: 'up' | 'down' | 'left' | 'right';
  movement: 'walk' | 'running' | 'jump' | 'surf' | 'ride';
  pet: Pet | null;
};

type FacingPlayer = {
  facing: 'up' | 'down' | 'left' | 'right';
};

const players = new Map<string, Player>(); //키 값은 socketId로 쓰자.
const accountSocketMap = new Map<number, string>(); // accountId -> socket.id 매핑용도
const locationRooms = new Map<string, Set<string>>(); // location -> Set<socketId> 매핑용도

export function registerEvent(io: Server) {
  io.on('connection', (socket: Socket) => {
    let isAuthenticated = false;
    let accountId: number | null = null;

    players.set(socket.id, {
      location: null,
      x: null,
      y: null,
      nickname: null,
      avatar: null,
      facing: 'down',
      pet: null,
      gender: null,
      option: { textSpeed: null, frame: null, backgroundVolume: null, effectVolume: null },
      pc: { bgs: initPcBgArrays(), names: initPcNamesArrays() },
    });

    socket.on('authenticate', (token: string) => {
      const payload = parseAccessToken(token);
      if (!payload) {
        socket.emit('authenticated', { success: false, error: 'Invalid token' });
        return;
      }

      accountId = payload.id;
      isAuthenticated = true;

      accountSocketMap.set(accountId, socket.id);
      socket.emit('authenticated', { success: true, error: null });
    });

    socket.on('init', (data: Player) => {
      if (!isAuthenticated || !accountId) return;
      initPlayer(accountId, data);
    });

    socket.on('update_player', (data: Player) => {
      if (!isAuthenticated || !accountId) return;
      updatePlayer(socket.id, data);
    });

    socket.on('enter_location', (data: MoveLocation) => {
      if (!isAuthenticated || !accountId) return;
      moveLocation(io, socket.id, data);
    });

    socket.on('movement_player', (data: MovementPlayer) => {
      if (!isAuthenticated || !accountId) return;
      movementPlayer(io, socket.id, data);
    });

    socket.on('facing_player', (data: 'up' | 'down' | 'left' | 'right') => {
      if (!isAuthenticated || !accountId) return;
      facingPlayer(io, socket.id, data);
    });

    socket.on('change_pet', (data: Pet) => {
      if (!isAuthenticated || !accountId) return;
      changePet(io, socket.id, data);
    });

    socket.on('disconnect', () => {
      const player = players.get(socket.id);

      if (player && player.location) {
        const currentRoom = locationRooms.get(player.location);
        if (currentRoom && currentRoom.has(socket.id)) {
          currentRoom.delete(socket.id);

          if (currentRoom.size === 0) {
            locationRooms.delete(player.location);
          }

          currentRoom.forEach((otherSocketId) => {
            const otherSocket = io.sockets.sockets.get(otherSocketId);
            if (otherSocket) {
              otherSocket.emit('exit_player', {
                socketId: socket.id,
                player: player,
              });
            }
          });
        }
      }

      if (accountId) {
        accountSocketMap.delete(accountId);
      }
      players.delete(socket.id);
    });
  });
}

const initPcBgArrays = () => {
  const pcBg = [];
  for (let i = 0; i < 33; i++) {
    pcBg.push(0);
  }
  return pcBg;
};

const initPcNamesArrays = () => {
  const pcNames = [];
  for (let i = 0; i < 33; i++) {
    pcNames.push('');
  }
  return pcNames;
};

const initPlayer = (accountId: number, data: Player) => {
  const socketId = accountSocketMap.get(accountId);
  if (!socketId) return;

  const player = players.get(socketId);
  if (!player) return;

  players.set(socketId, {
    ...player,
    ...data,
  });
};

const updatePlayer = (socketId: string, data: Partial<Player>) => {
  const player = players.get(socketId);
  if (!player) return;

  players.set(socketId, {
    ...player,
    ...data,
  });
};

const moveLocation = (io: Server, socketId: string, data: MoveLocation) => {
  const player = players.get(socketId);
  if (!player) return;

  players.set(socketId, {
    ...player,
    location: data.to,
    x: data.toX,
    y: data.toY,
  });

  if (data.from && data.from !== null) {
    const fromRoom = locationRooms.get(data.from);
    if (fromRoom && fromRoom.has(socketId)) {
      fromRoom.delete(socketId);

      if (fromRoom.size === 0) {
        locationRooms.delete(data.from);
      }

      fromRoom.forEach((otherSocketId) => {
        const otherSocket = io.sockets.sockets.get(otherSocketId);
        if (otherSocket) {
          otherSocket.emit('exit_player', {
            socketId: socketId,
            player: player,
          });
        }
      });
    }
  }

  const toRoom = locationRooms.get(data.to) || new Set<string>();
  toRoom.add(socketId);
  locationRooms.set(data.to, toRoom);

  const currentPlayersInRoom: Array<{ socketId: string; player: Player }> = [];
  toRoom.forEach((otherSocketId) => {
    if (otherSocketId !== socketId) {
      const otherPlayer = players.get(otherSocketId);
      if (otherPlayer) {
        currentPlayersInRoom.push({
          socketId: otherSocketId,
          player: otherPlayer,
        });
      }
    }
  });

  const enteringSocket = io.sockets.sockets.get(socketId);
  if (enteringSocket) {
    enteringSocket.emit('current_players_in_room', {
      location: data.to,
      players: currentPlayersInRoom,
    });
  }

  toRoom.forEach((otherSocketId) => {
    if (otherSocketId !== socketId) {
      const otherSocket = io.sockets.sockets.get(otherSocketId);
      if (otherSocket) {
        otherSocket.emit('enter_player', {
          socketId: socketId,
          player: players.get(socketId),
        });
      }
    }
  });
};

const movementPlayer = (io: Server, socketId: string, data: MovementPlayer) => {
  const player = players.get(socketId);
  if (!player) return;

  players.set(socketId, {
    ...player,
    x: data.x,
    y: data.y,
    facing: data.direction,
  });

  if (player.location) {
    const currentRoom = locationRooms.get(player.location);
    if (currentRoom) {
      currentRoom.forEach((otherSocketId) => {
        if (otherSocketId !== socketId) {
          const otherSocket = io.sockets.sockets.get(otherSocketId);
          if (otherSocket) {
            otherSocket.emit('player_movement', {
              socketId: socketId,
              data: data,
            });
          }
        }
      });
    }
  }
};

const facingPlayer = (io: Server, socketId: string, data: 'up' | 'down' | 'left' | 'right') => {
  const player = players.get(socketId);
  if (!player) return;

  players.set(socketId, {
    ...player,
    facing: data,
  });

  if (player.location) {
    const currentRoom = locationRooms.get(player.location);
    if (currentRoom) {
      currentRoom.forEach((otherSocketId) => {
        if (otherSocketId !== socketId) {
          const otherSocket = io.sockets.sockets.get(otherSocketId);
          if (otherSocket) {
            otherSocket.emit('facing_player', {
              socketId: socketId,
              data: data,
            });
          }
        }
      });
    }
  }
};

const changePet = (io: Server, socketId: string, data: Pet) => {
  const player = players.get(socketId);
  if (!player) return;

  players.set(socketId, {
    ...player,
    pet: { idx: data.idx, texture: data.texture },
  });

  if (player.location) {
    const currentRoom = locationRooms.get(player.location);
    if (currentRoom) {
      currentRoom.forEach((otherSocketId) => {
        if (otherSocketId !== socketId) {
          const otherSocket = io.sockets.sockets.get(otherSocketId);
          if (otherSocket) {
            otherSocket.emit('change_pet', {
              socketId: socketId,
              data: data,
            });
          }
        }
      });
    }
  }
};
