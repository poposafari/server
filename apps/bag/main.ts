import app from "./app";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import "reflect-metadata";
import { AppDataSource } from "./src/db/data-source";
import { redis } from "./src/db/redis-source";
import { BagService } from "./src/services/bag.service";

dotenv.config();

const PORT = process.env.SERVICE_BAG_PORT;

async function boot() {
  try {
    await AppDataSource.initialize();
    console.log("database connected");

    await redis.connect();
    console.log("redis connected");

    await loadData();
    console.log("item data loaded");

    app.listen(PORT, () => {
      console.log(`account service is running on port ${PORT}`);
    });
  } catch (err) {
    console.error("init failed:", err);
    process.exit(1);
  }
}

async function loadData(): Promise<void> {
  const filePath = path.resolve(__dirname, "./item.json");
  const rawData = fs.readFileSync(filePath, "utf-8");
  BagService.data = JSON.parse(rawData);
  console.log("Item data loaded into memory.");
}

boot();
