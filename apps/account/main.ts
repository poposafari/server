import app from "./app";
import * as dotenv from "dotenv";
import "reflect-metadata";
import { AppDataSource } from "./src/db/data-source";
import { redis } from "./src/db/redis-source";

dotenv.config();

const PORT = process.env.SERVICE_ACCOUNT_PORT;

async function boot() {
  try {
    await AppDataSource.initialize();
    console.log("database connected");

    await redis.connect();
    console.log("redis connected");

    app.listen(PORT, () => {
      console.log(`account service is running on port ${PORT}`);
    });
  } catch (err) {
    console.error("init failed:", err);
    process.exit(1);
  }
}

boot();
