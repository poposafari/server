import * as fs from "fs";
import * as path from "path";
import { QueryRunner } from "typeorm";
import { AppDataSource } from "./data-source";

const TABLES_TO_CLEAN = ["map_data", "item_data", "pokemon_data"];
const SEED_FILES = ["map_data.sql", "item_data.sql", "pokemon_data.sql"];

async function startSeeding() {
  let queryRunner: QueryRunner | null = null;
  try {
    console.log("[INFO] Starting database seeding...");

    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      console.log("[INFO] Database connected.");
    }

    queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    for (const table of TABLES_TO_CLEAN) {
      console.log(`[INFO] Cleaning table: ${table}...`);
      const tableExists = await queryRunner.hasTable(table);

      if (tableExists) {
        await queryRunner.query(`TRUNCATE TABLE "${table}" CASCADE`);
      }
    }
    console.log("[INFO] Tables cleaned successfully.");

    const dir = path.join(__dirname, "./seeds");

    for (const fileName of SEED_FILES) {
      const filePath = path.join(dir, fileName);
      console.log(`[INFO] Executing ${fileName}...`);

      if (!fs.existsSync(filePath)) {
        throw new Error(`[ERROR] File not found: ${filePath}`);
      }
      const sql = fs.readFileSync(filePath, "utf-8");

      await queryRunner.query(sql);
    }

    await queryRunner.commitTransaction();
    console.log("[INFO] All seed files executed successfully.");
  } catch (error) {
    console.error("[ERROR] Seeding failed. Rolling back transaction.");

    if (queryRunner && queryRunner.isTransactionActive) {
      await queryRunner.rollbackTransaction();
    }

    console.error(error);
  } finally {
    if (queryRunner) {
      await queryRunner.release();
    }
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
    console.log("[INFO] Seeding process finished.");
    process.exit(0);
  }
}

startSeeding();
