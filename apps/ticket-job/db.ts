import { Client } from "pg";
import * as dotenv from "dotenv";

dotenv.config();

export const pgClient = new Client({
  host: process.env.DB_0_NAME,
  port: 5432,
  user: process.env.DB_0_USERNAME,
  password: process.env.DB_0_PASSWORD,
  database: process.env.DB_0_NAME,
});
