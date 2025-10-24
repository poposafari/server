import { Server, Socket } from 'socket.io';
import { parseAccessToken } from './auth';
import { DatabaseService } from './service';
import * as cron from 'node-cron';

export type InitPlayerData = {
  location: string;
  x: number;
  y: number;
  nickname: string;
  gender: 'boy' | 'girl';
  avatar: number;
  pet: Pet | null;
  party: (number | null)[];
  slotItem: (number | null)[];
  option: PlayerOption;
  pcBgs: number[];
  pcNames: string[];
};

export type Player = {
  location: string;
  x: number;
  y: number;
  nickname: string;
  avatar: number;
  facing: 'up' | 'down' | 'left' | 'right';
  pet: Pet | null;
  party: (number | null)[];
  slotItem: (number | null)[];
  gender: 'boy' | 'girl';
  option: PlayerOption;
  pc: PcData;
};

export type PlayerOption = {
  textSpeed: number;
  frame: number;
  backgroundVolume: number;
  effectVolume: number;
};

export type PcData = {
  bgs: number[];
  names: string[];
  pokemonNicknames: { [key: number]: string };
};

export type Pet = {
  idx: number;
  texture: string | null;
};

export type MoveLocation = {
  from: string | null;
  to: string;
  toX: number;
  toY: number;
};

export type MoveToTitle = {
  from: string;
};

export type MovementPlayer = {
  x: number;
  y: number;
  direction: 'up' | 'down' | 'left' | 'right';
  petDirection: 'up' | 'down' | 'left' | 'right';
  movement: 'walk' | 'running' | 'jump' | 'surf' | 'ride';
  pet: Pet | null;
};

const players = new Map<string, Player>(); //키 값은 socketId로 쓰자.
const accountSocketMap = new Map<number, string>(); // accountId -> socket.id 매핑용도
const locationRooms = new Map<string, Set<string>>(); // location -> Set<socketId> 매핑용도

// cron.schedule('*/5 * * * *', async () => {
//   console.log('Start save Player data every 5 minutes...');

//   for (const [socketId, player] of players.entries()) {
//     const accountId = Array.from(accountSocketMap.entries()).find(([_, id]) => id === socketId)?.[0];

//     if (accountId && player) {
//       try {
//         await DatabaseService.savePlayerData(accountId, player);
//         console.log(`Success save Player data : accountId=${accountId}, socketId=${socketId}`);
//       } catch (error) {
//         console.error(`Fail save Player data : accountId=${accountId}, socketId=${socketId}`, error);
//       }
//     }
//   }
// });

export function registerEvent(io: Server) {
  io.on('connection', (socket: Socket) => {
    let isAuthenticated = false;
    let accountId: number | null = null;

    players.set(socket.id, {
      location: '',
      x: 0,
      y: 0,
      nickname: '',
      avatar: 1,
      facing: 'down',
      pet: null,
      party: [null, null, null, null, null, null],
      slotItem: [null, null, null, null, null],
      gender: 'boy',
      option: { textSpeed: 1, frame: 0, backgroundVolume: 5, effectVolume: 5 },
      pc: { bgs: initPcBgArrays(), names: initPcNamesArrays(), pokemonNicknames: {} },
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

    socket.on('init', (data: InitPlayerData) => {
      if (!isAuthenticated || !accountId) return;
      initPlayer(accountId, data);
    });

    socket.on('update_player', (data: Player) => {
      if (!isAuthenticated || !accountId) return;
      updatePlayer(socket.id, data);
    });

    socket.on('move_title', (data: MoveToTitle) => {
      if (!isAuthenticated || !accountId) return;
      moveToTitle(io, socket.id, data);
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

    socket.on('change_option', (data: PlayerOption) => {
      if (!isAuthenticated || !accountId) return;
      const player = players.get(socket.id);
      if (!player) return;

      updatePlayer(socket.id, { option: data });
    });

    socket.on('change_pc_name', (data: { idx: number; name: string }) => {
      if (!isAuthenticated || !accountId) return;
      const player = players.get(socket.id);
      if (!player) return;

      const newNames = [...player.pc.names];
      newNames[data.idx] = data.name;
      updatePlayer(socket.id, { pc: { ...player.pc, names: newNames } });
    });

    socket.on('change_pc_bg', (data: { idx: number; bg: number }) => {
      if (!isAuthenticated || !accountId) return;
      const player = players.get(socket.id);
      if (!player) return;

      const newBgs = [...player.pc.bgs];
      newBgs[data.idx] = data.bg;
      updatePlayer(socket.id, { pc: { ...player.pc, bgs: newBgs } });
    });

    socket.on('change_pokemon_nickname', (data: { idx: number; nickname: string }) => {
      if (!isAuthenticated || !accountId) return;
      const player = players.get(socket.id);
      if (!player) return;

      const newPokemonNicknames = { ...player.pc.pokemonNicknames };
      newPokemonNicknames[data.idx] = data.nickname;
      updatePlayer(socket.id, { pc: { ...player.pc, pokemonNicknames: newPokemonNicknames } });
    });

    socket.on('change_party', (data: (number | null)[]) => {
      if (!isAuthenticated || !accountId) return;
      const player = players.get(socket.id);
      if (!player) return;

      let newParty = [...player.party];
      newParty = data;
      updatePlayer(socket.id, { party: newParty });
    });

    socket.on('change_slot_item', (data: (number | null)[]) => {
      if (!isAuthenticated || !accountId) return;
      const player = players.get(socket.id);
      if (!player) return;

      let newSlotItem = [...player.slotItem];
      newSlotItem = data;
      updatePlayer(socket.id, { slotItem: newSlotItem });
    });

    socket.on('disconnect', async () => {
      const player = players.get(socket.id);

      if (player && accountId) {
        try {
          await DatabaseService.savePlayerData(accountId, player);
          console.log(`Success save Player data : accountId=${accountId}, socketId=${socket.id}`);
        } catch (error) {
          console.error(`Fail save Player data : accountId=${accountId}, socketId=${socket.id}`, error);
        }
      }

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

const initPlayer = (accountId: number, data: Partial<Player>) => {
  const socketId = accountSocketMap.get(accountId);
  if (!socketId) return;

  const player = players.get(socketId);
  if (!player) return;

  players.set(socketId, {
    ...player,
    ...data,
  });

  console.log('init players');
  console.log(players);
};

const updatePlayer = (socketId: string, data: Partial<Player>) => {
  const player = players.get(socketId);
  if (!player) return;

  players.set(socketId, {
    ...player,
    ...data,
  });

  console.log(players);
};

const moveToTitle = (io: Server, socketId: string, data: MoveToTitle) => {
  const player = players.get(socketId);
  if (!player) return;

  players.set(socketId, {
    ...player,
    location: data.from,
  });

  if (data.from) {
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

  console.log(players);
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
