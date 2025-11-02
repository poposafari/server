import * as dotenv from 'dotenv';
import { Client } from 'pg';

dotenv.config();

export const pgClient = new Client({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
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
