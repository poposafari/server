# 스테이징/프로덕션: tsc 빌드 후 node로 실행 (ts-node 미사용)
FROM node:20-alpine

RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY apps ./apps
COPY lib ./lib

# 현재는 prod 스키마가 안정 상태이며 schema 변경은 별도 절차(아래 주석 참조)로 처리.
# 마이그레이션을 다시 자동화할 시점에 두 줄을 복원하면 된다:
#   COPY drizzle.config.ts ./
#   COPY drizzle ./drizzle

RUN pnpm run build

ENV NODE_ENV=PROD
EXPOSE 9000 9010

# 기본은 API; compose에서 socket/worker는 command로 덮어씀
CMD ["node", "--heapsnapshot-near-heap-limit=1", "dist/apps/api/main.js"]