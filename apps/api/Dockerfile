FROM node:18

WORKDIR /usr/src/app

COPY .env ./
COPY wait-for-it.sh ./wait-for-it.sh

RUN chmod +x ./wait-for-it.sh

COPY ./apps/api/package*.json ./
COPY ./apps/api/tsconfig.json ./
RUN npm install

COPY ./apps/api/ ./
RUN npm run build

CMD ["./wait-for-it.sh", "db:5432", "--", "npm", "run", "start"]
