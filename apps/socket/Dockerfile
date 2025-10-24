FROM node:18

WORKDIR /usr/src/app

COPY ../../.env ./
COPY ../../wait-for-it.sh ./wait-for-it.sh
COPY ../../entrypoint.sh ./entrypoint.sh

RUN chmod +x ./wait-for-it.sh
RUN chmod +x ./entrypoint.sh

COPY ./apps/socket/package*.json ./
RUN npm install

CMD ["npm", "run", "start:socket"]