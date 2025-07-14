FROM node:18

WORKDIR /usr/src/app

COPY ./apps/socket ./
COPY ../../.env ./
COPY ../../wait-for-it.sh ./wait-for-it.sh
COPY ../../entrypoint.sh ./entrypoint.sh

RUN chmod +x ./wait-for-it.sh
RUN chmod +x ./entrypoint.sh

RUN npm install

CMD ["./entrypoint.sh"]