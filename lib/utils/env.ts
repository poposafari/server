import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

const nodeEnv = process.env.NODE_ENV;
const envFile =
  nodeEnv === 'PROD' ? '.env' : nodeEnv === 'test' || nodeEnv === 'TEST' ? '.env.test' : '.env.dev';

dotenv.config({ path: path.resolve(process.cwd(), envFile) });

const envSchema = z.object({
  // Environment
  NODE_ENV: z.enum(['DEV', 'PROD', 'test']).default('DEV'),

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

  // SERVICES
  API_PORT: z.coerce.number(),
  SOCKET_PORT: z.coerce.number(),

  /** PROD에서 전역/인증 레이트 리밋 적용 여부. 스테이징 부하 테스트 시 false로 끌 수 있음. env는 문자열이므로 "true"/"false" 명시 파싱 (z.coerce.boolean은 "false"를 truthy로 true로 만듦) */
  RATE_LIMIT_ENABLED: z.string().transform((s) => s === 'true' || s === '1'),

  /** 동시 게임 접속 슬롯 최대치. 초과 시 신규 진입은 FIFO 큐로 들어간다. */
  SLOT_CAPACITY: z.coerce.number().int().positive().default(50),

  // CORS
  CORS_ORIGIN: z.string().optional(),

  // OAuth — Google
  OAUTH_GOOGLE_CLIENT_ID: z.string().min(1),
  OAUTH_GOOGLE_CLIENT_SECRET: z.string().min(1),
  OAUTH_GOOGLE_REDIRECT_URI: z.string().url(),

  // OAuth — Discord
  OAUTH_DISCORD_CLIENT_ID: z.string().min(1),
  OAUTH_DISCORD_CLIENT_SECRET: z.string().min(1),
  OAUTH_DISCORD_REDIRECT_URI: z.string().url(),

  // OAuth — 콜백 후 클라이언트 리다이렉트 (success/failure)
  OAUTH_CLIENT_SUCCESS_URL: z.string().url(),
  OAUTH_CLIENT_FAILURE_URL: z.string().url(),

  INTERNAL_TOKEN: z.string().optional(),
});

const envCheck = envSchema.safeParse(process.env);

if (!envCheck.success) {
  console.error('[ERROR] Invalid environment variables:', envCheck.error);
  throw new Error('Invalid environment variables');
}

export const envConfig = envCheck.data;
