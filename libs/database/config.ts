import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";
import { z } from "zod";

const envFile = process.env.NODE_ENV === "PROD" ? ".env" : ".env.dev";

const envSchema = z.object({
  NODE_ENV: z.enum(["DEV", "PROD", "TEST"]).default("DEV"),
  POSTGRES_HOST: z.string().min(1, "Database host is required"),
  POSTGRES_PORT: z.coerce.number().default(5432),
  POSTGRES_USER: z.string().min(1, "Database user is required"),
  POSTGRES_PASSWORD: z.string().min(1, "Database password is required"),
  POSTGRES_DB: z.string().min(1, "Database name is required"),
});

const envCheck = envSchema.safeParse(process.env);

if (!envCheck.success) {
  console.error(
    "[ERROR] Invalid environment variables:",
    envCheck.error.format()
  );
  throw new Error("Invalid environment variables");
}

export const config = envCheck.data;
