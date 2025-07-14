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

const players = new Map<string, Player>();

export function registerEvent(io: Server) {
  io.on('connection', (socket: Socket) => {
    const accountId = socket.data.account_id;
    players.set(accountId, { overworld: null, x: null, y: null, nickname: null, gender: null, avatar: null, pet: null });

    console.log(`[SOCKET CONNECTED] account_id=${accountId}`);

    socket.on('init', (data: Player) => {
      const accountId = socket.data.account_id;

      const player = players.get(accountId);
      if (!player) return;

      players.set(accountId, {
        ...player,
        ...data,
      });

      console.log(`[INIT] Updated player info for account_id=${accountId}`);
      console.log(players);
    });

    socket.on('enter', (overworld: string) => {
      socket.join(`plaza-${overworld}`);
    });

    socket.on('disconnect', () => {
      console.log(`[SOCKET DISCONNECTED] account_id=${accountId}`);
    });
  });
}
