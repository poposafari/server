import { monitorEventLoopDelay, IntervalHistogram } from 'perf_hooks';
import { envConfig } from './env';

export interface LoadtestMetricsSnapshot {
  enabled: true;
  ts: number;
  mode: string;
  tickRateMs: number;
  /** 스크레이프 간격(ms). 이전 스크레이프 시각과의 차. 첫 호출은 프로세스 부팅 이후 */
  windowMs: number;
  counters: {
    moveReceived: number;
    emitCalls: number;
    updatesSent: number;
    ticksRun: number;
    ticksNonEmpty: number;
  };
  /** 이벤트 루프 지연(ms). 매 스크레이프마다 리셋되므로 직전 window 구간의 분포 */
  loopDelayMs: Percentiles;
  /** 한 틱에서 방 버퍼를 모아 emit 하기까지 걸린 시간(ms). 매 스크레이프마다 리셋 */
  tickDurationMs: Percentiles;
  rooms: { sockets: number; rooms: Record<string, number> };
  memory: NodeJS.MemoryUsage;
}

export interface Percentiles {
  count: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  mean: number;
}

const EMPTY_PERCENTILES: Percentiles = { count: 0, p50: 0, p95: 0, p99: 0, max: 0, mean: 0 };

/** 틱 처리시간 표본 상한. 33ms 틱 × 1초 스크레이프면 ~30개라 넉넉하다 */
const TICK_SAMPLE_CAP = 20000;

class LoadtestMetrics {
  readonly enabled = envConfig.LOADTEST_METRICS;

  private loopDelay: IntervalHistogram | null = null;
  private tickSamples: number[] = [];
  private lastScrapeAt = Date.now();

  private counters = {
    moveReceived: 0,
    emitCalls: 0,
    updatesSent: 0,
    ticksRun: 0,
    ticksNonEmpty: 0,
  };

  private roomProvider: (() => { sockets: number; rooms: Record<string, number> }) | null = null;

  start(): void {
    if (!this.enabled || this.loopDelay) return;
    this.loopDelay = monitorEventLoopDelay({ resolution: 1 });
    this.loopDelay.enable();
  }

  setRoomProvider(fn: () => { sockets: number; rooms: Record<string, number> }): void {
    this.roomProvider = fn;
  }

  countMove(): void {
    if (this.enabled) this.counters.moveReceived += 1;
  }

  countEmit(updates: number): void {
    if (!this.enabled) return;
    this.counters.emitCalls += 1;
    this.counters.updatesSent += updates;
  }

  countTick(nonEmpty: boolean, durationMs: number): void {
    if (!this.enabled) return;
    this.counters.ticksRun += 1;
    if (nonEmpty) this.counters.ticksNonEmpty += 1;
    if (this.tickSamples.length < TICK_SAMPLE_CAP) this.tickSamples.push(durationMs);
  }

  snapshot(): LoadtestMetricsSnapshot {
    const now = Date.now();
    const windowMs = now - this.lastScrapeAt;
    this.lastScrapeAt = now;

    const loop = this.loopDelay ? histToPercentiles(this.loopDelay) : EMPTY_PERCENTILES;
    this.loopDelay?.reset();

    const tick = samplesToPercentiles(this.tickSamples);
    this.tickSamples = [];

    return {
      enabled: true,
      ts: now,
      mode: envConfig.MOVE_BROADCAST_MODE,
      tickRateMs: envConfig.TICK_RATE_MS,
      windowMs,
      counters: { ...this.counters },
      loopDelayMs: loop,
      tickDurationMs: tick,
      rooms: this.roomProvider?.() ?? { sockets: 0, rooms: {} },
      memory: process.memoryUsage(),
    };
  }
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function histToPercentiles(h: IntervalHistogram): Percentiles {
  const ns = 1e6;
  return {
    count: h.count,
    p50: round(h.percentile(50) / ns),
    p95: round(h.percentile(95) / ns),
    p99: round(h.percentile(99) / ns),
    max: round(h.max / ns),
    mean: round((Number.isFinite(h.mean) ? h.mean : 0) / ns),
  };
}

function samplesToPercentiles(samples: number[]): Percentiles {
  if (samples.length === 0) return { ...EMPTY_PERCENTILES };
  const sorted = [...samples].sort((a, b) => a - b);
  const at = (p: number) =>
    round(sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]);
  const sum = sorted.reduce((a, b) => a + b, 0);
  return {
    count: sorted.length,
    p50: at(50),
    p95: at(95),
    p99: at(99),
    max: round(sorted[sorted.length - 1]),
    mean: round(sum / sorted.length),
  };
}

export const loadtestMetrics = new LoadtestMetrics();
