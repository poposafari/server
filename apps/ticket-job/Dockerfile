FROM node:18

WORKDIR /usr/src/app

COPY ../../.env ./
COPY ../../wait-for-it.sh ./wait-for-it.sh
COPY ../../entrypoint.sh ./entrypoint.sh

RUN chmod +x ./wait-for-it.sh
RUN chmod +x ./entrypoint.sh

COPY ./apps/ticket-job/package*.json ./
RUN npm install

COPY ./apps/ticket-job/ ./
RUN npm run build

CMD ["npm", "run", "start"]