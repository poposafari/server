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

describe('AuthService', () => {
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
