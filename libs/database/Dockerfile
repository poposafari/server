# Base Image
FROM node:20-alpine

# Docker 컨테이너 내 작업 디렉터리를 '루트'로 잡습니다.
WORKDIR /usr/src/app

# 1. 의존성 설치를 위한 매니페스트 파일 복사
# 루트의 package.json과 lock 파일 복사
COPY package.json package-lock.json ./

# 모노레포 워크스페이스 구조를 인식시키기 위해 database 패키지의 json도 제자리에 복사
COPY libs/database/package.json libs/database/

# 2. 의존성 설치
# NODE_ENV가 DEV이므로 devDependencies(ts-node 등)도 함께 설치됩니다.
RUN npm ci

# 3. 소스 코드 및 설정 파일 복사
# TypeScript 컴파일 및 실행을 위한 루트 설정 파일
COPY tsconfig.json .

# 실제 데이터베이스 코드 복사
COPY libs/common libs/common
COPY libs/database libs/database

# 4. 실행 명령
# docker-compose의 'command'가 이 부분을 덮어쓰며 실행하게 됩니다.
# 여기서는 기본적으로 대기하거나 에코를 찍어둡니다.
CMD ["echo", "Ready to seed"]