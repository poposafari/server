import * as dotenv from 'dotenv';
import { Client } from 'pg';
import { createClient } from 'redis';

dotenv.config();

export const pgClient = new Client({
  host: process.env.DB_0_NAME,
  port: 5432,
  user: process.env.DB_0_USERNAME,
  password: process.env.DB_0_PASSWORD,
  database: process.env.DB_0_NAME,
});

export const redis = createClient({
  url: 'redis://redis:6379',
});
