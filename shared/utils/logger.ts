import winston from 'winston';
import winstonDaily from 'winston-daily-rotate-file';
import path from 'path';
import { envConfig } from './env';

const logDir = path.join(process.cwd(), 'logs');
const logLevel = envConfig.NODE_ENV === 'PROD' ? 'info' : 'debug';
const { combine, timestamp, printf, json, colorize, errors } = winston.format;

//DEV용으로 사용할 로그 포맷
const prettyPrintFormat = printf(({ level, message, timestamp, stack }) => {
  if (stack) return `${timestamp} [${level}]: ${message}\n${stack}`;
  return `${timestamp} [${level}]: ${message}`;
});

export const logger = winston.createLogger({
  level: logLevel,
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }), // 에러 발생 시 스택 트레이스 포함
    json(), // 기본은 JSON (나중에 파일에 쓸 때 유용)
  ),
  transports: [], // 일단 비워둠 (아래에서 환경별로 추가)
});

if (envConfig.NODE_ENV !== 'PROD') {
  logger.add(
    new winston.transports.Console({
      format: combine(
        colorize({ all: true }), // 색깔 입히기 허용
        prettyPrintFormat, // DEV용 텍스트 포맷 적용
      ),
    }),
  );
} else {
  logger.add(
    new winstonDaily({
      level: 'info',
      datePattern: 'YYYY-MM-DD',
      dirname: logDir,
      filename: `%DATE%.log`, // ex: 2026-01-16.log
      maxFiles: '14d', // 14일치만 보관하고 자동 삭제
      zippedArchive: true, // 압축해서 저장
    }),
  );

  logger.add(
    new winstonDaily({
      level: 'error',
      datePattern: 'YYYY-MM-DD',
      dirname: path.join(logDir, 'error'), // logs/error 폴더에 저장
      filename: `%DATE%.error.log`,
      maxFiles: '30d', // 에러는 중요하니까 30일 보관
      zippedArchive: true,
    }),
  );

  //PROD 환경에서도 PM2나 Docker 로그 확인을 위해 콘솔 출력은 유지하되, 색깔은 빼고 JSON으로 출력
  logger.add(
    new winston.transports.Console({
      format: json(),
    }),
  );
}
