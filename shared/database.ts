import { DataSource } from 'typeorm';
import { join } from 'path';
import { envConfig } from '@poposerver/shared/utils';
import { logger } from './utils/logger';
import { Auth } from './entities';
import * as entities from './entities';

logger.debug('---------------------------------------------------');
logger.debug(`1. Current NODE_ENV: ${envConfig.NODE_ENV}`);
logger.debug(`2. Is Synchronize True?: ${envConfig.NODE_ENV === 'DEV'}`);
logger.debug(`3. Loaded Entities: ${Object.keys(entities).join(', ')}`);
logger.debug('---------------------------------------------------');

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: envConfig.DB_HOST,
  port: envConfig.DB_PORT,
  username: envConfig.DB_USERNAME,
  password: envConfig.DB_PASSWORD,
  database: envConfig.DB_DATABASE,
  // 개발 환경('DEV')일 때만 스키마 자동 동기화 (프로덕션에서는 매우 위험하므로 false)
  synchronize: envConfig.NODE_ENV === 'DEV',
  // 개발 환경일 때만 쿼리 로그 출력
  logging: envConfig.NODE_ENV === 'DEV',
  // 엔티티 파일 경로: 빌드된 후(.js)와 개발 중(.ts) 모두 대응하도록 설정
  entities: Object.values(entities),
  // 마이그레이션 파일 경로
  migrations: [],
  subscribers: [],
});

export const connectDB = async (dataSource: DataSource, serviceName: string) => {
  try {
    if (!dataSource.isInitialized) {
      await dataSource.initialize();
      logger.info(`${serviceName} Database connection initialized successfully.`);
    }
  } catch (error) {
    logger.error(`${serviceName} Error initializing database connection:`, error);
    throw error;
  }
};
