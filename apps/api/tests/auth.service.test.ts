import bcrypt from 'bcrypt';
import * as sharedUtils from '@poposerver/shared';
import { AuthService } from '../domains/auth/auth.service';
import { AppError, AppErrorCode, AppErrorMessage, UserAuthProvider } from '@poposerver/shared';

jest.mock('bcrypt');
jest.mock('@poposerver/shared', () => {
  const actual = jest.requireActual('@poposerver/shared');
  return {
    ...actual,

    generateTokenPair: jest.fn(),
    saveRefreshTokenInRedis: jest.fn(),
    deleteRefreshTokenInRedis: jest.fn(),
    verifyToken: jest.fn(),
    verifyRefreshTokenInRedis: jest.fn(),
    generateAccessToken: jest.fn(),
    AppDataSource: {
      initialize: jest.fn(),
      destroy: jest.fn(),
      isInitialized: false,
      getRepository: jest.fn(),
      createQueryRunner: jest.fn(),
    },
    redisClient: {
      connect: jest.fn(),
      disconnect: jest.fn(),
      on: jest.fn(),
    },
  };
});

describe('회원가입(로컬) 유닛 테스트', () => {
  let authService: AuthService;
  let mockAuthRepository: any;
  let mockDataSource: any;
  let mockQueryRunner: any;

  beforeEach(() => {
    mockQueryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
    };

    mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
    };

    mockAuthRepository = {
      findByProviderAndProviderId: jest.fn(),
      findByProviderIdWithPassword: jest.fn(),
      create: jest.fn(),
      softDelete: jest.fn(),
      findByIdWithDeleted: jest.fn(),
    };

    authService = new AuthService(mockAuthRepository, mockDataSource);
  });

  it('정상 201: DB에 저장도 되고, 토큰도 발급되어야 한다.', async () => {
    //Arrange(상황)
    mockAuthRepository.findByProviderAndProviderId.mockResolvedValue(null);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
    mockAuthRepository.create.mockResolvedValue({ id: 1 });
    (sharedUtils.generateTokenPair as jest.Mock).mockReturnValue({
      accessToken: 'test_access_token',
      refreshToken: 'test_refresh_token',
    });

    //Act(실행)
    const result = await authService.registerLocal({
      username: 'test_username',
      password: 'test_password',
    });

    //Assert(검증)
    expect(result).toEqual({
      authId: 1,
      accessToken: 'test_access_token',
      refreshToken: 'test_refresh_token',
    });

    expect(mockAuthRepository.findByProviderAndProviderId).toHaveBeenCalledWith(
      UserAuthProvider.LOCAL,
      'test_username',
    );
    expect(bcrypt.hash).toHaveBeenCalledWith('test_password', 10);

    expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    expect(mockQueryRunner.release).toHaveBeenCalled();
  });

  it('에러 409: 이미 존재하는 username이라면, CONFLICT 에러를 던진다.', async () => {
    //Arrange
    mockAuthRepository.findByProviderAndProviderId.mockResolvedValue({
      id: 1,
      provider: UserAuthProvider.LOCAL,
      providerId: 'test_username',
    });

    //Act & Assert
    await expect(
      authService.registerLocal({
        username: 'test_username',
        password: 'test_password',
      }),
    ).rejects.toThrow(
      new AppError(AppErrorMessage.USER_ALREADY_EXISTS, 409, AppErrorCode.CONFLICT),
    );
  });

  it('에러 500: DB가 죽어 있는 상황이라면, 저장되지 않고 롤백되어야 한다.', async () => {
    //Arrange
    mockAuthRepository.findByProviderAndProviderId.mockResolvedValue(null);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');

    //DB가 죽어 있다고 가정.
    const dbError = new Error();
    mockAuthRepository.create.mockRejectedValue(dbError);

    //Act & Assert
    await expect(
      authService.registerLocal({
        username: 'test_username',
        password: 'test_password',
      }),
    ).rejects.toThrow();

    expect(mockQueryRunner.startTransaction).toHaveBeenCalled(); //startTransaction 호출되었는지 확인
    expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled(); //commitTransaction 호출되지 않았는지 확인
    expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled(); //rollbackTransaction 호출되었는지 확인
    expect(mockQueryRunner.release).toHaveBeenCalled(); //release 호출되었는지 확인
  });

  it('에러 500: DB 저장까지는 완료했지만, 토큰 발급 쪽에서 에러가 발생하면, DB가 롤백되어야 한다.', async () => {
    //Arrange
    mockAuthRepository.findByProviderAndProviderId.mockResolvedValue(null);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
    mockAuthRepository.create.mockResolvedValue({ id: 1 });

    //토큰 생성 부분에서 에러가 발생했다고 가정
    const tokenError = new Error('Failed to generate token pair');
    (sharedUtils.generateTokenPair as jest.Mock).mockImplementation(() => {
      throw tokenError;
    });

    //Act & Assert
    await expect(
      authService.registerLocal({
        username: 'test_username',
        password: 'test_password',
      }),
    ).rejects.toThrow('Failed to generate token pair');

    expect(mockAuthRepository.create).toHaveBeenCalled();
    expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    expect(mockQueryRunner.release).toHaveBeenCalled();
  });
});

describe('로그인(로컬) 유닛 테스트', () => {
  let authService: AuthService;
  let mockAuthRepository: any;
  let mockDataSource: any;
  let mockQueryRunner: any;

  beforeEach(() => {
    mockQueryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
    };

    mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
    };

    mockAuthRepository = {
      findByProviderAndProviderId: jest.fn(),
      findByProviderIdWithPassword: jest.fn(),
      create: jest.fn(),
      softDelete: jest.fn(),
      findByIdWithDeleted: jest.fn(),
    };

    authService = new AuthService(mockAuthRepository, mockDataSource);
  });

  it('정상 200: 로그인 성공 시, 토큰을 반환한다.', async () => {
    //Arrange
    const mockRequest = { username: 'test_user', password: 'test_password' };
    mockAuthRepository.findByProviderIdWithPassword.mockResolvedValue({
      id: 1,
      provider: UserAuthProvider.LOCAL,
      providerId: 'test_user',
      password: 'hashedPassword',
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (sharedUtils.generateTokenPair as jest.Mock).mockReturnValue({
      accessToken: 'test_access_token',
      refreshToken: 'test_refresh_token',
    });

    //Act
    const result = await authService.loginLocal(mockRequest);

    //Assert
    expect(result).toEqual({
      authId: 1,
      accessToken: 'test_access_token',
      refreshToken: 'test_refresh_token',
    });

    expect(mockAuthRepository.findByProviderIdWithPassword).toHaveBeenCalledWith(
      UserAuthProvider.LOCAL,
      'test_user',
    );

    expect(bcrypt.compare).toHaveBeenCalledWith('test_password', 'hashedPassword');
  });

  it('에러 401: 비밀번호가 일치하지 않는다면, UNAUTHORIZED 에러를 던진다.', async () => {
    //Arrange
    mockAuthRepository.findByProviderIdWithPassword.mockResolvedValue({
      id: 1,
      provider: UserAuthProvider.LOCAL,
      providerId: 'test_user',
      password: 'hashedPassword',
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    //Act
    await expect(
      authService.loginLocal({
        username: 'test_username',
        password: 'test_password',
      }),
    ).rejects.toThrow(
      new AppError(AppErrorMessage.INVALID_CREDENTIALS, 401, AppErrorCode.UNAUTHORIZED),
    );
  });

  it('에러 401: 존재하지 않는 username이라면, UNAUTHORIZED 에러를 던진다.', async () => {
    //Arrange
    mockAuthRepository.findByProviderIdWithPassword.mockResolvedValue(null);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    //Act
    await expect(
      authService.loginLocal({
        username: 'test_username',
        password: 'test_password',
      }),
    ).rejects.toThrow(
      new AppError(AppErrorMessage.INVALID_CREDENTIALS, 401, AppErrorCode.UNAUTHORIZED),
    );
  });
});

describe('로그아웃 유닛 테스트', () => {
  let authService: AuthService;
  let mockAuthRepository: any;
  let mockDataSource: any;
  let mockQueryRunner: any;

  beforeEach(() => {
    mockQueryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
    };

    mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
    };

    mockAuthRepository = {
      findByProviderAndProviderId: jest.fn(),
      findByProviderIdWithPassword: jest.fn(),
      create: jest.fn(),
      softDelete: jest.fn(),
      findByIdWithDeleted: jest.fn(),
    };

    authService = new AuthService(mockAuthRepository, mockDataSource);
  });

  it('정상 200: 로그아웃 시, deleteRefreshTokenInRedis 함수가 호출되어야 한다.', async () => {
    //Arrange
    const authId = '1';
    await authService.logout(authId);

    expect(sharedUtils.deleteRefreshTokenInRedis).toHaveBeenCalledWith(authId);
  });
});

describe('회원탈퇴 유닛 테스트', () => {
  let authService: AuthService;
  let mockAuthRepository: any;
  let mockDataSource: any;

  beforeAll(() => {
    mockAuthRepository = {
      findByProviderAndProviderId: jest.fn(),
      findByProviderIdWithPassword: jest.fn(),
      create: jest.fn(),
      softDelete: jest.fn(),
      findByIdWithDeleted: jest.fn(),
    };

    mockDataSource = {
      createQueryRunner: jest.fn(),
    };

    authService = new AuthService(mockAuthRepository, mockDataSource);
  });

  it('정상 200: 회원탈퇴 시, softDelete 함수가 호출되어야 한다.', async () => {
    //Arrange
    mockAuthRepository.findByIdWithDeleted.mockResolvedValue({
      id: 1,
      provider: UserAuthProvider.LOCAL,
      providerId: 'test_user',
      password: 'hashedPassword',
      deletedAt: null,
    });

    //Act
    mockAuthRepository.softDelete.mockResolvedValue(undefined);
    (sharedUtils.deleteRefreshTokenInRedis as jest.Mock).mockResolvedValue(undefined);

    await authService.softDeleteAuth('1');

    //Assert
    expect(mockAuthRepository.findByIdWithDeleted).toHaveBeenCalledWith('1');
    expect(mockAuthRepository.softDelete).toHaveBeenCalledWith('1');
    expect(sharedUtils.deleteRefreshTokenInRedis).toHaveBeenCalledWith('1');
  });

  it('에러 404: 회원탈퇴 시, 회원이 존재하지 않는다면, NOT_FOUND 에러를 던진다.', async () => {
    //Arrange
    mockAuthRepository.findByIdWithDeleted.mockResolvedValue(null);

    //Act & Assert
    await expect(authService.softDeleteAuth('1')).rejects.toThrow(
      new AppError(AppErrorMessage.NOT_FOUND, 404, AppErrorCode.NOT_FOUND),
    );
  });

  it('에러 409: 회원탈퇴 시, 회원이 이미 탈퇴한 상황이라면, CONFLICT 에러를 던진다.', async () => {
    //Arrange
    mockAuthRepository.findByIdWithDeleted.mockResolvedValue({
      id: 1,
      provider: UserAuthProvider.LOCAL,
      providerId: 'test_user',
      password: 'hashedPassword',
      deletedAt: new Date(),
    });

    //Act & Assert
    await expect(authService.softDeleteAuth('1')).rejects.toThrow(
      new AppError(AppErrorMessage.USER_ALREADY_DELETED, 409, AppErrorCode.CONFLICT),
    );
  });
});

describe('리프레시 토큰 흐름 유닛 테스트', () => {
  let authService: AuthService;
  let mockAuthRepository: any;
  let mockDataSource: any;

  beforeAll(() => {
    mockAuthRepository = {
      findByProviderAndProviderId: jest.fn(),
      findByProviderIdWithPassword: jest.fn(),
      create: jest.fn(),
      softDelete: jest.fn(),
      findByIdWithDeleted: jest.fn(),
    };

    mockDataSource = {
      createQueryRunner: jest.fn(),
    };

    authService = new AuthService(mockAuthRepository, mockDataSource);
  });

  it('정상 200: 리프레시 토큰 흐름 시, accessToken을 반환한다.', async () => {
    //Arrange
    const payload = { authId: '1' };
    (sharedUtils.verifyToken as jest.Mock).mockReturnValue(payload);
    (sharedUtils.verifyRefreshTokenInRedis as jest.Mock).mockResolvedValue(true);
    (sharedUtils.generateAccessToken as jest.Mock).mockReturnValue('test_access_token');

    //Act
    const result = await authService.startRefreshTokenFlow('test_refresh_token');

    //Assert
    expect(result).toEqual({ accessToken: 'test_access_token' });
    expect(sharedUtils.verifyToken).toHaveBeenCalledWith('refresh', 'test_refresh_token');
    expect(sharedUtils.verifyRefreshTokenInRedis).toHaveBeenCalledWith('1', 'test_refresh_token');
    expect(sharedUtils.generateAccessToken).toHaveBeenCalledWith('1');
  });

  it('에러 401: 리프레시 토큰 흐름 시, 쿠키에 존재하는 리프레시 토큰이 유효하지 않다면, UNAUTHORIZED 에러를 던진다.', async () => {
    //Arrange
    (sharedUtils.verifyToken as jest.Mock).mockReturnValue(null);

    //Act & Assert
    await expect(authService.startRefreshTokenFlow('test_refresh_token')).rejects.toThrow(
      new AppError(AppErrorMessage.INVALID_CREDENTIALS, 401, AppErrorCode.UNAUTHORIZED),
    );
  });

  it('에러 401: 리프레시 토큰 흐름 시, 레디스에 저장된 리프레시 토큰이 유효하지 않다면, UNAUTHORIZED 에러를 던진다.', async () => {
    //Arrange
    (sharedUtils.verifyToken as jest.Mock).mockReturnValue({ authId: '1' });
    (sharedUtils.verifyRefreshTokenInRedis as jest.Mock).mockResolvedValue(false);

    //Act & Assert
    await expect(authService.startRefreshTokenFlow('test_refresh_token')).rejects.toThrow(
      new AppError(AppErrorMessage.INVALID_CREDENTIALS, 401, AppErrorCode.UNAUTHORIZED),
    );
  });
});
