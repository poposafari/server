FROM node:18

WORKDIR /usr/src/app

COPY ../../package*.json ./
COPY ../../tsconfig.json ./
COPY ../../.env ./
COPY ../../wait-for-it.sh ./wait-for-it.sh
COPY ../../db/entities/Account.ts ./bag/src/entities/Account.ts
COPY ../../db/entities/Bag.ts ./bag/src/entities/Bag.ts
COPY ../../share/ ./bag/src/share

RUN chmod +x ./wait-for-it.sh

RUN npm install

COPY ./apps/bag ./bag

RUN pwd && ls -al && cd bag/src/share && ls -al

CMD ["./wait-for-it.sh", "db0:5432", "--", "npm", "run", "start:bag"]
