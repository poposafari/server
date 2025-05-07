import path from "path";
import * as fs from "fs";
import app from "./app";
import * as dotenv from "dotenv";
import "reflect-metadata";
import { AppDataSource, redis } from "./src/data-source";
import { ItemData, OverworldData, PokemonData, SpawnableItemTable } from "./src/store";
import { getSpawnableItemTable, readJson } from "./src/utils/methods";

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

    await loadPokemon();
    console.log("Pokemon data loaded");

    loadSpawnableItem();
    console.log("Spawnable Item data loaded");

    app.listen(PORT, () => {
      console.log(`api is running on port ${PORT}`);
    });
  } catch (err) {
    console.error("init failed:", err);
    process.exit(1);
  }
}

async function loadItem(): Promise<void> {
  const data = readJson("item");

  Object.keys(ItemData).forEach((k) => delete ItemData[k]);
  Object.assign(ItemData, data);

  console.log("Item data loaded into memory.");
}

function loadSpawnableItem(): void {
  const data = getSpawnableItemTable();

  SpawnableItemTable.length = 0;
  SpawnableItemTable.push(...data);

  console.log("Spawnable Item data loaded into memory.");
}

async function loadOverworld(): Promise<void> {
  const data = readJson("overworld");

  Object.keys(OverworldData).forEach((k) => delete OverworldData[k]);
  Object.assign(OverworldData, data);

  console.log("Overworld data loaded into memory.");
}

async function loadPokemon(): Promise<void> {
  const data = readJson("pokemon");

  Object.keys(PokemonData).forEach((k) => delete PokemonData[k]);
  Object.assign(PokemonData, data);

  console.log("Pokemon data loaded into memory.");
}

boot();
