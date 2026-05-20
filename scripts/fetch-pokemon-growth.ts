import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

function csvCell(v: string): string {
  if (v === '' || v == null) return '';
  if (/[",\r\n]/.test(v)) return '"' + v.replace(/"/g, '""') + '"';
  return v;
}

function stringifyCsv(rows: Record<string, string>[], columns: string[]): string {
  const lines: string[] = [columns.join(',')];
  for (const row of rows) {
    lines.push(columns.map((c) => csvCell(row[c] ?? '')).join(','));
  }
  return lines.join('\n') + '\n';
}

type GrowthGroup = 'fast' | 'medium_fast' | 'medium_slow' | 'slow' | 'erratic' | 'fluctuating';

const POKEAPI_GROWTH_MAP: Record<string, GrowthGroup> = {
  fast: 'fast',
  medium: 'medium_fast',
  'medium-slow': 'medium_slow',
  slow: 'slow',
  'slow-then-very-fast': 'fluctuating',
  'fast-then-very-slow': 'erratic',
};

const FALLBACK_GROWTH: GrowthGroup = 'medium_fast';
const FALLBACK_BASE_EXP = 64;
const TOTAL_SPECIES = Number(process.env.LIMIT) || 1025;
const CONCURRENCY = Number(process.env.CONCURRENCY) || 20;

interface SpeciesData {
  growthGroup: GrowthGroup;
  baseExp: number;
}

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.json();
}

async function fetchSpecies(id: number): Promise<SpeciesData> {
  const [species, pokemon] = await Promise.all([
    fetchJson(`https://pokeapi.co/api/v2/pokemon-species/${id}/`),
    fetchJson(`https://pokeapi.co/api/v2/pokemon/${id}/`),
  ]);
  const rate = species.growth_rate?.name ?? '';
  const group = POKEAPI_GROWTH_MAP[rate] ?? FALLBACK_GROWTH;
  const baseExp =
    typeof pokemon.base_experience === 'number' ? pokemon.base_experience : FALLBACK_BASE_EXP;
  return { growthGroup: group, baseExp };
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
  throw lastErr;
}

async function runPool<I, O>(
  items: I[],
  worker: (item: I, idx: number) => Promise<O>,
  concurrency: number,
): Promise<O[]> {
  const out: O[] = new Array(items.length);
  let cursor = 0;
  const runners: Promise<void>[] = [];
  for (let i = 0; i < Math.min(concurrency, items.length); i++) {
    runners.push(
      (async () => {
        while (true) {
          const idx = cursor++;
          if (idx >= items.length) return;
          out[idx] = await worker(items[idx], idx);
        }
      })(),
    );
  }
  await Promise.all(runners);
  return out;
}

async function main() {
  const csvPath = path.join(__dirname, '../lib/master/pokemon.csv');
  console.log(`[1/3] CSV 로드: ${csvPath}`);
  const raw = fs.readFileSync(csvPath, 'utf-8').replace(/^﻿/, '');
  const rows: Record<string, string>[] = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
  console.log(`  총 ${rows.length}행`);

  console.log(`[2/3] PokeAPI fetch (1~${TOTAL_SPECIES}, concurrency=${CONCURRENCY})`);
  const ids = Array.from({ length: TOTAL_SPECIES }, (_, i) => i + 1);
  const t0 = Date.now();
  let done = 0;
  const results = await runPool(
    ids,
    async (id) => {
      const data = await withRetry(() => fetchSpecies(id));
      done++;
      if (done % 50 === 0 || done === TOTAL_SPECIES) {
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        console.log(`  ${done}/${TOTAL_SPECIES} (${elapsed}s)`);
      }
      return [id, data] as const;
    },
    CONCURRENCY,
  );
  const speciesMap = new Map<number, SpeciesData>(results);
  console.log(`  완료. ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  console.log(`[3/3] CSV에 growth_group, base_exp 컬럼 추가/갱신`);
  let filled = 0;
  let fallback = 0;
  for (const row of rows) {
    const idStr = row.id;
    const intPart = parseInt(idStr, 10);
    const data = Number.isFinite(intPart) ? speciesMap.get(intPart) : undefined;
    if (data) {
      row.growth_group = data.growthGroup;
      row.base_exp = String(data.baseExp);
      filled++;
    } else {
      row.growth_group = FALLBACK_GROWTH;
      row.base_exp = String(FALLBACK_BASE_EXP);
      fallback++;
    }
  }

  // 컬럼 순서: 기존 컬럼 뒤에 growth_group, base_exp 부착
  const baseCols = Object.keys(rows[0]).filter((k) => k !== 'growth_group' && k !== 'base_exp');
  const cols = [...baseCols, 'growth_group', 'base_exp'];
  const out = stringifyCsv(rows, cols);
  fs.writeFileSync(csvPath, out, 'utf-8');
  console.log(`  채움: ${filled}, fallback: ${fallback}, 출력: ${csvPath}`);
}

main().catch((err) => {
  console.error('실패:', err);
  process.exit(1);
});
