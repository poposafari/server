FROM node:20-alpine

RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY apps ./apps
COPY shared ./shared

ENV NODE_ENV=PROD
EXPOSE 9000 9010

# 기본은 API; compose에서 socket/worker는 command로 덮어씀
CMD ["pnpm", "exec", "ts-node", "-r", "tsconfig-paths/register", "apps/api/main.ts"]