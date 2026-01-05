import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { ItemData, MapData, PokemonData } from 'shared/types';

/**
 * Python 스타일의 리스트 문자열("['a', 'b']")을 JS 배열로 변환
 */
const parsePythonList = (value: string): string[] => {
  if (!value || value === '[]') return [];
  try {
    const jsonString = value.replace(/'/g, '"');
    return JSON.parse(jsonString);
  } catch (error) {
    console.warn(`Failed to parse list string: ${value}`, error);
    return [];
  }
};

/**
 * Python 스타일의 Boolean 문자열("True", "False")을 JS Boolean으로 변환
 */
const parseBoolean = (value: string): boolean => {
  return value === 'True';
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

  public async load(): Promise<void> {
    if (this.isLoaded) {
      console.warn('[WARN] StaticStorage is already loaded.');
      return;
    }

    const baseDir = path.join(__dirname, '../master');

    try {
      if (!fs.existsSync(baseDir)) {
        throw new Error(`Static directory not found at: ${baseDir}`);
      }

      this.loadItems(path.join(baseDir, 'item.csv'));
      this.loadPokemons(path.join(baseDir, 'pokemon.csv'));
      this.loadMaps(path.join(baseDir, 'map.csv'));
      this.isLoaded = true;
      console.info('[INFO] StaticStorage loaded successfully.');
    } catch (error) {
      console.error('[ERROR] Failed to load StaticStorage:', error);
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

        if (
          key.includes('spawn_rate') ||
          key.includes('spawn_max') ||
          key.includes('buy') ||
          key.includes('sell')
        ) {
          item[camelKey] = Number(value);
        } else if (key.endsWith('able') || key === 'purchasable') {
          item[camelKey] = parseBoolean(value);
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
          key === 'generation'
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

  private loadMaps(filePath: string): void {
    const records = this.readCsv(filePath);
    records.forEach((record) => {
      const mapData: any = {};
      Object.keys(record).forEach((key) => {
        const camelKey = toCamelCase(key);
        const value = record[key];

        if (key.endsWith('_max') || key === 'cost') {
          mapData[camelKey] = Number(value);
        } else if (value.startsWith('[') && value.endsWith(']')) {
          mapData[camelKey] = parsePythonList(value);
        } else {
          mapData[camelKey] = value;
        }
      });

      console.log('--- Debug Map Data ---');
      console.log(mapData);
      console.log('--- Debug Map Data End ---');
      this.maps.set(mapData.id, mapData as MapData);
    });
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
    return this.pokemons.get(id);
  }

  public getMap(id: string): MapData | undefined {
    return this.maps.get(id);
  }

  public getAllMaps(): MapData[] {
    return Array.from(this.maps.values());
  }
}

export const MasterData = new MasterDataService();
