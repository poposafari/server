import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { ItemData, MapData, PokemonData } from 'lib/types';
import { logger } from './logger';

/**
 * Python 스타일의 리스트 문자열("['a', 'b']")을 JS 배열로 변환
 */
const parsePythonList = (value: string): string[] => {
  if (!value || value === '[]') return [];
  try {
    const jsonString = value.replace(/['‘’]/g, '"');
    return JSON.parse(jsonString);
  } catch (error) {
    logger.warn(`Failed to parse list string: ${value}`, error);
    return [];
  }
};

/**
 * Python 스타일의 Boolean 문자열("True", "False")을 JS Boolean으로 변환
 */
const parseBoolean = (value: string): boolean => {
  return value === 'TRUE';
};

/**
 * snake_case string to camelCase
 */
const toCamelCase = (str: string): string => {
  return str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
};

class MasterDataService {
  private items: Map<string, ItemData> = new Map();
  private pokemons: Map<string, PokemonData> = new Map();
  private maps: Map<string, MapData> = new Map();
  private isLoaded = false;

  constructor() {}

  public async load(serviceName: string): Promise<void> {
    if (this.isLoaded) {
      logger.warn('StaticStorage is already loaded.');
      return;
    }

    const baseDir = path.join(__dirname, '../master');

    try {
      if (!fs.existsSync(baseDir)) {
        throw new Error(`Static directory not found at: ${baseDir}`);
      }

      this.loadItems(path.join(baseDir, 'item.csv'));
      this.loadPokemons(path.join(baseDir, 'pokemon.csv'));
      this.loadMapJson(baseDir);
      this.isLoaded = true;
      logger.info('StaticStorage loaded successfully.');
    } catch (error) {
      logger.error('Failed to load StaticStorage:', error);
      throw error;
    }
  }

  private loadItems(filePath: string): void {
    const records = this.readCsv(filePath);
    records.forEach((record) => {
      const item: any = {};
      Object.keys(record).forEach((key) => {
        const camelKey = toCamelCase(key);
        const value = record[key];

        if (key.endsWith('able')) {
          item[camelKey] = parseBoolean(value);
        } else if (key === 'buy' || key === 'sell') {
          item[camelKey] = Number(value);
        } else {
          item[camelKey] = value;
        }
      });
      this.items.set(item.id, item as ItemData);
    });
  }

  private loadPokemons(filePath: string): void {
    const records = this.readCsv(filePath);
    records.forEach((record) => {
      const pokemon: any = {};
      Object.keys(record).forEach((key) => {
        const camelKey = toCamelCase(key);
        const value = record[key];

        if (
          key.startsWith('rate_') ||
          key.endsWith('_kg') ||
          key.endsWith('_m') ||
          key === 'generation' ||
          key === 'base_exp'
        ) {
          pokemon[camelKey] = Number(value);
        } else if (value.startsWith('[') && value.endsWith(']')) {
          pokemon[camelKey] = parsePythonList(value);
        } else {
          pokemon[camelKey] = value === '' ? null : value;
        }
      });
      this.pokemons.set(pokemon.id, pokemon as PokemonData);
    });
  }

  private loadMapJson(baseDir: string): void {
    const mapRaw = JSON.parse(fs.readFileSync(path.join(baseDir, 'map.json'), 'utf-8'));
    const entryRaw = JSON.parse(fs.readFileSync(path.join(baseDir, 'map-entry.json'), 'utf-8'));

    for (const [id, data] of Object.entries<any>(mapRaw)) {
      const entry = entryRaw[id] ? { x: entryRaw[id].x, y: entryRaw[id].y } : null;
      if (data.type === 'safari' && data.wild) {
        const { levelMin, levelMax } = data.wild;
        if (
          typeof levelMin !== 'number' ||
          typeof levelMax !== 'number' ||
          !Number.isInteger(levelMin) ||
          !Number.isInteger(levelMax) ||
          levelMin < 1 ||
          levelMax > 100 ||
          levelMin > levelMax
        ) {
          throw new Error(
            `Invalid wild level range for map ${id}: levelMin=${levelMin}, levelMax=${levelMax}`,
          );
        }
      }
      this.maps.set(id, {
        id,
        comment: data.comment,
        type: data.type,
        cost: data.cost,
        item: data.item,
        wild: data.wild,
        entry,
      } as MapData);
    }
  }

  private readCsv(filePath: string): any[] {
    let fileContent = fs.readFileSync(filePath, 'utf-8');
    fileContent = fileContent.replace(/^\uFEFF/, '');

    return parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
  }

  // --- Getters ---

  public getItem(id: string): ItemData | undefined {
    return this.items.get(id);
  }

  public getPokemon(id: string): PokemonData | undefined {
    const direct = this.pokemons.get(id);
    if (direct) return direct;
    if (/^0+\d+$/.test(id)) {
      const stripped = String(parseInt(id, 10));
      return this.pokemons.get(stripped);
    }
    return undefined;
  }

  public getMap(id: string): MapData | undefined {
    return this.maps.get(id);
  }

  public getAllMaps(): MapData[] {
    return Array.from(this.maps.values());
  }
}

export const MasterData = new MasterDataService();
