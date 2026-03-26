import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import { envConfig } from './utils';
import { logger } from './utils/logger';
import * as schema from './schema';

const client = postgres({
  host: envConfig.DB_HOST,
  port: envConfig.DB_PORT,
  user: envConfig.DB_USERNAME,
  password: envConfig.DB_PASSWORD,
  database: envConfig.DB_DATABASE,
});

export const db = drizzle(client, { schema });

export const connectDB = async (serviceName: string) => {
  try {
    await db.execute(sql`SELECT 1`);
    logger.info(`${serviceName} PostgreSQL connection initialized successfully.`);
  } catch (error) {
    logger.error(`${serviceName} Error initializing PostgreSQL connection:`, error);
    throw error;
  }
};
