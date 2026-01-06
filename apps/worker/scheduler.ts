import cron from 'node-cron';
import { TimeManager } from './services/time.service';
import { SpawnManager } from './services/spawn.service';
import { MovementManager } from './services/movement.service';

const MOVEMENT_TICK_MS = 1000;

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

    this.movementTickLoop();
  }

  private async movementTickLoop(): Promise<void> {
    const start = Date.now();

    try {
      await MovementManager.processMovements();
    } catch (error) {
      console.error('[GameLoop] Error processing movements:', error);
    } finally {
      setTimeout(() => this.movementTickLoop(), MOVEMENT_TICK_MS);
    }
  }
}
export const SchedulerManager = new SchedulerService();
