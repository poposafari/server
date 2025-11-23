import { PcData, Player, PlayerOption } from 'app';
import { pgClient } from './db';

export class DatabaseService {
  static async savePlayerData(accountId: number, player: Player) {
    try {
      await pgClient.query('BEGIN');

      await this.updateIngameData(accountId, player);
      await this.updateIngameOption(accountId, player.option);
      await this.updatePcData(accountId, player.pc);

      await pgClient.query('COMMIT');
    } catch (error) {
      await pgClient.query('ROLLBACK');
      throw error;
    }
  }

  private static async updateIngameData(accountId: number, player: Player) {
    const query = `
      UPDATE db.ingame 
      SET 
        nickname = $1,
        x = $2,
        y = $3,
        location = $4,
        gender = $5,
        avatar = $6,
        party = $7, 
        slot_item = $8,
        pc_bg = $9,
        pc_name = $10,
        is_starter_0 = $11,
        is_starter_1 = $12,
        updated_at = CURRENT_TIMESTAMP
      WHERE account_id = $13
    `;

    const values = [
      player.nickname,
      player.x,
      player.y,
      player.location,
      player.gender,
      player.avatar,
      player.party,
      player.slotItem,
      `{${player.pc.bgs.join(',')}}`,
      `{${player.pc.names.map((name: string) => `"${name}"`).join(',')}}`,
      player.isStarter0,
      player.isStarter1,
      accountId,
    ];

    await pgClient.query(query, values);
  }

  private static async updateIngameOption(accountId: number, option: PlayerOption) {
    const query = `
      UPDATE db.ingame_option 
      SET
        text_speed = $1,
        frame = $2,
        background_volume = $3,
        effect_volume = $4,
        tutorial = $5
      WHERE account_id = $6
    `;

    const values = [option.textSpeed, option.frame, option.backgroundVolume, option.effectVolume, option.tutorial, accountId];

    await pgClient.query(query, values);
  }

  private static async updatePcData(accountId: number, pc: PcData) {
    if (!pc || !pc.pokemonNicknames) return;

    const entries = Object.entries(pc.pokemonNicknames);
    if (entries.length === 0) return;

    for (const [idxString, rawNickname] of entries) {
      const idx = Number(idxString);
      if (!Number.isFinite(idx)) continue;

      const nickname = (rawNickname ?? '').toString().slice(0, 20);

      await pgClient.query('UPDATE db.pc SET nickname = $1 WHERE idx = $2 AND account_id = $3', [nickname, idx, accountId]);
    }
  }
}
