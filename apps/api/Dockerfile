FROM node:18

WORKDIR /usr/src/app

COPY ./apps/api/package.json ./
COPY ./apps/api/tsconfig.json ./

COPY ../../.env ./
COPY ../../wait-for-it.sh ./wait-for-it.sh
COPY ./apps/api ./api

RUN npm install

RUN chmod +x ./wait-for-it.sh
RUN pwd && ls -al

CMD ["./wait-for-it.sh", "db:5432", "--", "npm", "run", "start:dev"]
