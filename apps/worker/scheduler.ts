import cron from 'node-cron';
import { TimeManager } from './services/time.service';
import { SpawnManager } from './services/spawn.service';

class SchedulerService {
  public start(): void {
    console.log('[Scheduler] Jobs started.');

    cron.schedule('* * * * *', async () => {
      await TimeManager.syncGlobalTime();
    });

    cron.schedule('*/1 * * * *', async () => {
      console.log('--- [Spawn] Pokemon Tick ---');
      await SpawnManager.spawnPokemons();
    });

    cron.schedule('*/30 * * * *', async () => {
      console.log('--- [Spawn] Item Tick ---');
      await SpawnManager.spawnItems();
    });
  }
}

export const SchedulerManager = new SchedulerService();
