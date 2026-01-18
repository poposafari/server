import { AuthController } from '../domains/auth/auth.controller';
import { AppDataSource, Auth, RedisClient } from '@poposerver/shared';
import { AuthService } from '../domains/auth/auth.service';
import { AuthRepository } from '../domains/auth/auth.repository';

describe('registerLocal 동시성 테스트', () => {
  let authService: AuthService;

  beforeEach(async () => {
    await AppDataSource.query('DELETE FROM auth_identities');
  });

  beforeAll(async () => {
    await AppDataSource.initialize();
    const authRepository = new AuthRepository(AppDataSource.getRepository(Auth));
    authService = new AuthService(authRepository, AppDataSource);
  });

  afterAll(async () => {
    await AppDataSource.destroy();
    RedisClient.disconnect();
  });

  afterEach(async () => {
    await AppDataSource.query('DELETE FROM auth_identities');
  });

  it('동시에 같은 username으로 가입 시, 하나는 성공하고 하나는 409 CONFLICT', async () => {
    const request = { username: 'test_user', password: 'password123' };

    // 동시성을 테스트 하기 위해, 동시에 실행함.
    const results = await Promise.allSettled([
      authService.registerLocal(request),
      authService.registerLocal(request),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled.length).toBe(1); // 하나는 성공
    expect(rejected.length).toBe(1); // 하나는 실패

    // 실패한 쪽이 409 CONFLICT인지 확인
    const error = (rejected[0] as PromiseRejectedResult).reason;
    expect(error.statusCode).toBe(409);
    expect(error.code).toBe('CONFLICT');
  }, 15000);
});
