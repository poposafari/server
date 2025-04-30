import path from "path";
import * as fs from "fs";
import app from "./app";
import * as dotenv from "dotenv";
import "reflect-metadata";
import { AppDataSource } from "./src/data-source";
import { redis } from "./src/redis-source";
import { BagService } from "./src/services/bag.service";
import { SafariService } from "./src/services/safari.service";

dotenv.config();

const PORT = process.env.SERVICE_API_PORT;

async function boot() {
  try {
    await AppDataSource.initialize();
    console.log("database connected");

    await redis.connect();
    console.log("redis connected");

    await loadItem();
    console.log("item data loaded");

    await loadOverworld();
    console.log("Overworld data loaded");

    app.listen(PORT, () => {
      console.log(`api is running on port ${PORT}`);
    });
  } catch (err) {
    console.error("init failed:", err);
    process.exit(1);
  }
}

async function loadItem(): Promise<void> {
  const filePath = path.resolve(__dirname, "./item.json");
  const rawData = fs.readFileSync(filePath, "utf-8");
  BagService.data = JSON.parse(rawData);
  console.log("Item data loaded into memory.");
}

async function loadOverworld(): Promise<void> {
  const filePath = path.resolve(__dirname, "./overworld.json");
  const rawData = fs.readFileSync(filePath, "utf-8");
  SafariService.data = JSON.parse(rawData);
  console.log("Overworld data loaded into memory.");
}

boot();
