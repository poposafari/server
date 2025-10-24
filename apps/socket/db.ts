import * as dotenv from 'dotenv';
import { Client } from 'pg';

dotenv.config();

export const pgClient = new Client({
  host: 'db', // Docker Compose 서비스 이름
  port: 5432,
  user: process.env.DB_0_USERNAME,
  password: process.env.DB_0_PASSWORD,
  database: process.env.DB_0_NAME,
});

export const initializeDatabase = async () => {
  try {
    await pgClient.connect();
    console.log('PostgreSQL connected successfully');
  } catch (error) {
    console.error('PostgreSQL connection failed:', error);
    throw error;
  }
};
