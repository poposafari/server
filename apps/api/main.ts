import app from './app';
import * as dotenv from 'dotenv';
import 'reflect-metadata';
import { AppDataSource } from './src/data-source';
import { readJson } from './src/utils/methods';
import { CatchData, ItemData, OverworldData, PokemonData, RewardCandyData, RewardData, SpawnableItemTable } from './src/shared/data';
import { Rarity } from './src/shared/enums';

dotenv.config();

const PORT = process.env.SERVICE_API_PORT;

async function boot() {
  try {
    await AppDataSource.initialize();
    console.log('database connected');

    await loadItem();
    console.log('item data loaded');

    await loadOverworld();
    console.log('Overworld data loaded');

    await loadPokemon();
    console.log('Pokemon data loaded');

    await loadCatchInfo();
    console.log('Catch Info data loaded');

    await loadRewardInfo();
    console.log('Reward Info data loaded');

    await loadCandyRewardInfo();
    console.log('Reward Candy Info data loaded');

    app.listen(PORT, () => {
      console.log(`api is running on port ${PORT}`);
    });
  } catch (err) {
    console.error('init failed:', err);
    process.exit(1);
  }
}

async function loadItem(): Promise<void> {
  const data = readJson('item');

  Object.keys(ItemData).forEach((k) => delete ItemData[k]);
  Object.assign(ItemData, data);

  console.log('Item data loaded into memory.');
}

async function loadOverworld(): Promise<void> {
  const data = readJson('overworld');

  Object.keys(OverworldData).forEach((k) => delete OverworldData[k]);
  Object.assign(OverworldData, data);

  console.log('Overworld data loaded into memory.');
}

async function loadPokemon(): Promise<void> {
  const data = readJson('pokemon');

  Object.keys(PokemonData).forEach((k) => delete PokemonData[k]);
  Object.assign(PokemonData, data);

  console.log('Pokemon data loaded into memory.');
}

async function loadCatchInfo(): Promise<void> {
  const data = readJson('catch');

  Object.keys(CatchData).forEach((k) => delete CatchData[k]);
  Object.assign(CatchData, data);
}

async function loadRewardInfo(): Promise<void> {
  const data = readJson('reward');

  Object.keys(RewardData).forEach((k) => delete RewardData[k as Rarity]);
  Object.assign(RewardData, data);
}

async function loadCandyRewardInfo(): Promise<void> {
  const data = readJson('rewardCandy');

  Object.keys(RewardCandyData).forEach((k) => delete RewardCandyData[k as Rarity]);
  Object.assign(RewardCandyData, data);
}

boot();
