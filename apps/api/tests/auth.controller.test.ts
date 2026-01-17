import { AuthController } from '../domains/auth/auth.controller';
import {
  AppDataSource,
  AppError,
  AppErrorCode,
  AppErrorMessage,
  Auth,
  REFRESH_TOKEN_COOKIE_NAME,
  refreshTokenCookieOptions,
} from '@poposerver/shared';
import { AuthService } from '../domains/auth/auth.service';
import { AuthRepository } from '../domains/auth/auth.repository';

describe('로그아웃 컨트롤러 유닛 테스트', () => {
  const mockRes = () => {
    const res: any = {};

    res.clearCookie = jest.fn().mockReturnValue(res);
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);

    return res;
  };

  const mockNext = jest.fn();

  it('정상 200: authId가 있으면 logout 호출 + 쿠키 삭제', async () => {
    const authService = { logout: jest.fn() };
    const auditService = { log: jest.fn() };
    const controller = new AuthController(authService as any, auditService as any);

    const req: any = { user: { authId: 'auth-1' } };
    const res = mockRes();

    await controller.logout(req, res, mockNext);

    expect(authService.logout).toHaveBeenCalledWith('auth-1');
    expect(res.clearCookie).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE_NAME,
      refreshTokenCookieOptions,
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: null });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('에러 401: authId가 없으면 UNAUTHORIZED를 next로 넘긴다', async () => {
    const authService = { logout: jest.fn() };
    const auditService = { log: jest.fn() };
    const controller = new AuthController(authService as any, auditService as any);

    const req: any = { user: null };
    const res = mockRes();

    await controller.logout(req, res, mockNext);
    expect(mockNext).toHaveBeenCalledWith(
      new AppError(AppErrorMessage.UNAUTHORIZED, 401, AppErrorCode.UNAUTHORIZED),
    );
  });
});

describe('registerLocal 동시성 테스트', () => {
  let authService: AuthService;

  beforeEach(async () => {
    // 각 테스트 전에 정리
    await AppDataSource.query('DELETE FROM auth_identities');
  });

  beforeAll(async () => {
    await AppDataSource.initialize();
    const authRepository = new AuthRepository(AppDataSource.getRepository(Auth));
    authService = new AuthService(authRepository, AppDataSource);
  });

  afterAll(async () => {
    await AppDataSource.destroy();
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
