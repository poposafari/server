import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

const isProd = process.env.NODE_ENV === 'PROD';
const envFile = isProd ? '.env' : '.env.dev';

dotenv.config({ path: path.resolve(__dirname, process.cwd(), envFile) });

const envSchema = z.object({
  // Environment
  NODE_ENV: z.enum(['DEV', 'PROD', 'TEST']).default('DEV'),

  // Database
  DB_HOST: z.string().min(1, 'Database host is required'),
  DB_PORT: z.coerce.number().default(5432),
  DB_USERNAME: z.string().min(1, 'Database user is required'),
  DB_PASSWORD: z.string().min(1, 'Database password is required'),
  DB_DATABASE: z.string().min(1, 'Database name is required'),

  // Redis
  REDIS_HOST: z.string().min(1, 'Redis host is required'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),

  // API
  API_PORT: z.coerce.number().default(3000),

  // Security
  JWT_ACCESS_SECRET: z.string().min(1, 'JWT access secret is required'),
  JWT_REFRESH_SECRET: z.string().min(1, 'JWT refresh secret is required'),

  // CORS
  CORS_ORIGIN: z.string().optional(),
});

const envCheck = envSchema.safeParse(process.env);

if (!envCheck.success) {
  console.error('[ERROR] Invalid environment variables:', envCheck.error);
  throw new Error('Invalid environment variables');
}

export const envConfig = envCheck.data;
