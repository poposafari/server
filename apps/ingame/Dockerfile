FROM node:18

WORKDIR /usr/src/app

COPY ../../package*.json ./
COPY ../../tsconfig.json ./
COPY ../../.env ./
COPY ../../wait-for-it.sh ./wait-for-it.sh
COPY ../../db/entities/Account.ts ./ingame/src/entities/Account.ts
COPY ../../db/entities/Ingame.ts ./ingame/src/entities/Ingame.ts
COPY ../../db/entities/ItemSlot.ts ./ingame/src/entities/ItemSlot.ts
COPY ../../db/entities/PartySlot.ts ./ingame/src/entities/PartySlot.ts
COPY ../../db/entities/PokeboxBg.ts ./ingame/src/entities/PokeboxBg.ts

COPY ../../share/ ./ingame/src/share

RUN chmod +x ./wait-for-it.sh

RUN npm install

COPY ./apps/ingame ./ingame

RUN pwd && ls -al && cd ./ingame && ls -al

CMD ["./wait-for-it.sh", "account:9910", "--", "npm", "run", "start:ingame"]
