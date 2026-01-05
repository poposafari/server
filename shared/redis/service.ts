import Redis from 'ioredis';
import { envConfig } from '../utils/env';

class RedisService {
  // 메인 클라이언트 (데이터 조회/저장용)
  private readonly client: Redis;
  // 구독 전용 클라이언트 (Pub/Sub용)
  private readonly subscriber: Redis;

  constructor() {
    // 1. 메인 클라이언트 설정
    this.client = new Redis({
      host: envConfig.REDIS_HOST,
      port: envConfig.REDIS_PORT,
      // password: envConfig.REDIS_PASSWORD, //TODO : 나중에 주석 지우자.
      lazyConnect: true, // TODO : 나중에 확인하자. 인스턴스 생성 시점이 아닌, 실제 사용 시점에 연결 시도
      retryStrategy: (times) => {
        // TODO : 나중에 확인하자. 연결 끊김 시 재연결 전략: 최대 2초 간격으로 계속 재시도
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    // 2. Pub/Sub용 클라이언트 (Redis 특성상 구독 모드에 들어가면 일반 명령어 불가하므로 분리)
    this.subscriber = this.client.duplicate();

    // 3. 에러 리스너 등록 (서버 죽는 것 방지)
    this.handleEvents(this.client, 'Client');
    this.handleEvents(this.subscriber, 'Subscriber');
  }

  private handleEvents(instance: Redis, name: string) {
    instance.on('connect', () => {
      console.log(`[Redis] ${name} connected`);
    });

    instance.on('error', (err) => {
      console.error(`[Redis] ${name} Error:`, err);
    });
  }

  /**
   * 서버 시작 시 연결을 명시적으로 수행
   */
  public async connect(): Promise<void> {
    try {
      if (this.client.status === 'wait') {
        await this.client.connect();
      }
      if (this.subscriber.status === 'wait') {
        await this.subscriber.connect();
      }
    } catch (error) {
      console.error('[Redis] Connection Failed:', error);
      throw error;
    }
  }

  /**
   * 원본 ioredis 클라이언트 반환 (복잡한 명령어 필요 시)
   */
  public getClient(): Redis {
    return this.client;
  }

  public getSubscriber(): Redis {
    return this.subscriber;
  }

  /**
   * JSON 객체 저장 (자동 직렬화)
   */
  public async setJson<T>(key: string, data: T, ttlSeconds?: number): Promise<void> {
    const stringified = JSON.stringify(data);
    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, stringified);
    } else {
      await this.client.set(key, stringified);
    }
  }

  /**
   * JSON 객체 조회 (자동 역직렬화)
   */
  public async getJson<T>(key: string): Promise<T | null> {
    const data = await this.client.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  }
}

export const RedisStore = new RedisService();
