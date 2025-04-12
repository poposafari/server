FROM node:18

WORKDIR /usr/src/app

COPY ../../package*.json ./
COPY ../../tsconfig.json ./
COPY ../../.env ./
COPY ../../wait-for-it.sh ./wait-for-it.sh
COPY ../../db/entities/Account.ts ./ticket-cron/entities/Account.ts
COPY ../../db/entities/Ingame.ts ./ticket-cron/entities/Ingame.ts
COPY ../../db/entities/ItemSlot.ts ./ticket-cron/entities/ItemSlot.ts
COPY ../../db/entities/PartySlot.ts ./ticket-cron/entities/PartySlot.ts
COPY ../../db/entities/PokeboxBg.ts ./ticket-cron/entities/PokeboxBg.ts

RUN chmod +x ./wait-for-it.sh

RUN npm install

COPY ./apps/ticket-cron ./ticket-cron

RUN pwd && ls -al && cd ./ticket-cron && ls -al

CMD ["./wait-for-it.sh", "db0:5432", "--", "npm", "run", "start:ticket-cron"]
