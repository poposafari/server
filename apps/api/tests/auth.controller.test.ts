import { AuthController } from '../domains/auth/auth.controller';
import {
  AppError,
  AppErrorCode,
  AppErrorMessage,
  REFRESH_TOKEN_COOKIE_NAME,
  refreshTokenCookieOptions,
} from '@poposerver/shared';

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
    const controller = new AuthController(authService as any);

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
    const controller = new AuthController(authService as any);

    const req: any = { user: null };
    const res = mockRes();

    await controller.logout(req, res, mockNext);

    expect(mockNext).toHaveBeenCalledWith(
      new AppError(AppErrorMessage.UNAUTHORIZED, 401, AppErrorCode.UNAUTHORIZED),
    );
  });
});
