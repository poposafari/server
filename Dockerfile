# 스테이징/프로덕션: tsc 빌드 후 node로 실행 (ts-node 미사용)
FROM node:20-alpine

# pnpm 버전 명시 — @latest는 Node 메이저 호환성을 깨뜨려 빌드 사고 유발
# (예: pnpm 11+는 Node 22.13+ 필요, node:sqlite 빌트인 사용)
# pnpm-lock.yaml의 lockfileVersion 9.0과 호환되는 pnpm 9 계열로 고정
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
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