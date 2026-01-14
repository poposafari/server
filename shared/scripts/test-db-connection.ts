/* eslint-disable no-console */
import 'reflect-metadata';
import { AppDataSource } from 'shared/database';

async function checkConnection() {
  console.log('[TEST] Checking database connection...');

  try {
    await AppDataSource.initialize();

    console.log('--------------------------------------------------');
    console.log('[TEST] Database connected successfully!');
    console.log('--------------------------------------------------');
    console.log(`[TEST] Database: ${AppDataSource.options.database}`);
    console.log(`[TEST] Synchronized: ${AppDataSource.options.synchronize}`);
    console.log(`[TEST] Logging: ${AppDataSource.options.logging}`);

    await AppDataSource.destroy();
    console.log('[TEST] Connection closed successfully.');

    process.exit(0);
  } catch (error) {
    console.error('--------------------------------------------------');
    console.error('[ERROR] Database Connection Failed!');
    console.error('--------------------------------------------------');
    console.error(error);
    process.exit(1);
  }
}

checkConnection();
