FROM node:18

WORKDIR /usr/src/app

COPY ./apps/ticket-job ./
COPY ../../.env ./
COPY ../../wait-for-it.sh ./wait-for-it.sh

RUN chmod +x ./wait-for-it.sh

RUN npm install

CMD ["./wait-for-it.sh", "db0:5432", "--", "npm", "run", "start:ticket-job"]
