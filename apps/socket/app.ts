import { Server, Socket } from 'socket.io';

type Player = {
  overworld: string | null;
  x: number | null;
  y: number | null;
  nickname: string | null;
  gender: 'boy' | 'girl' | null;
  avatar: 1 | 2 | 3 | 4 | null;
  pet: string | null;
};

type Location = {
  overworld: string;
  x: number;
  y: number;
};

type Move = {
  overworld: string;
  x: number;
  y: number;
  movement: string;
  petMovement: string;
};

const plaza = new Set(['000', '001', '002', '003', '004', '005', '006', '007', '008', '009', '010', '011', '012', '013', '014', '015', '016', '017', '018', '019', '020']);
const players = new Map<number, Player>();

export function registerEvent(io: Server) {
  io.on('connection', (socket: Socket) => {
    const accountId = socket.data.account_id;
    players.set(accountId, { overworld: null, x: null, y: null, nickname: null, gender: null, avatar: null, pet: null });

    socket.on('init', (data: Player) => {
      initPlayer(accountId, data);
    });

    socket.on('enter', (location: Location) => {
      updatePlayer(accountId, { ...location });
      for (const room of socket.rooms) {
        if (room.startsWith('plaza-')) {
          socket.to(room).emit('exit', accountId);
          socket.leave(room);
        }
      }

      if (location.overworld && plaza.has(location.overworld)) {
        const room = getRoomKey(location.overworld);

        sendPlayersInSameOverworld(io, socket, room);
        socket.to(room).emit('enter', accountId, players.get(accountId));

        socket.join(room);
      }
    });

    socket.on('disconnect', () => {
      players.delete(accountId);
    });

    socket.on('logout', () => {
      console.log('check logout', accountId);

      for (const room of socket.rooms) {
        if (room.startsWith('plaza-')) {
          socket.to(room).emit('exit', accountId);
          socket.leave(room);
        }
      }
    });

    socket.on('move', (data: { overworld: string; x: number; y: number; direction: string; status: string }) => {
      const room = getRoomKey(data.overworld);

      updatePlayer(accountId, { overworld: data.overworld, x: data.x, y: data.y });

      socket.to(room).emit('move', { id: accountId, direction: data.direction, status: data.status });
    });

    socket.on('pet', (data: { overworld: string; pet: string | null }) => {
      const room = getRoomKey(data.overworld);

      updatePlayer(accountId, { pet: data.pet });
      socket.to(room).emit('pet', { id: accountId, pet: data.pet });
    });
  });
}

const getRoomKey = (overworld: string) => {
  return `plaza-${overworld}`;
};

const sendPlayersInSameOverworld = (io: Server, socket: Socket, roomKey: string) => {
  const result: Record<string, Player> = {};

  const room = io.sockets.adapter.rooms.get(roomKey);
  if (!room) return;

  for (const socketId of room) {
    const s = io.sockets.sockets.get(socketId);
    if (!s) continue;

    const accountId = s.data.account_id;
    const player = players.get(accountId);
    if (player) {
      result[accountId] = player;
    }
  }

  socket.emit('get-players', result);
};

const initPlayer = (accountId: number, data: Player) => {
  const player = players.get(accountId);
  if (!player) return;

  players.set(accountId, {
    ...player,
    ...data,
  });
};

const updatePlayer = (accountId: number, patch: Partial<Player>) => {
  const player = players.get(accountId);
  if (!player) return;

  players.set(accountId, {
    ...player,
    ...patch,
  });
};
