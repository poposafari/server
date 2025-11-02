import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

export const pgClient = new Client({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});
