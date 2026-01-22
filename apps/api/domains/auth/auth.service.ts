import bcrypt from 'bcrypt';
import {
  AppError,
  AppErrorCode,
  AppErrorMessage,
  deleteRefreshTokenInRedis,
  generateAccessToken,
  generateTokenPair,
  saveRefreshTokenInRedis,
  TokenPair,
  UserAuthProvider,
  verifyRefreshTokenInRedis,
  verifyToken,
} from '@poposerver/shared';
import { AuthLocalReq } from './auth.dto';
import { AuthRepository } from './auth.repository';
import { DataSource } from 'typeorm';

export class AuthService {
  private readonly SALT_ROUNDS = 10;

  constructor(
    private readonly authRepository: AuthRepository,
    private readonly dataSource: DataSource,
  ) {}

  private async generateAndStoreTokens(authId: string): Promise<TokenPair> {
    const { accessToken, refreshToken } = generateTokenPair(authId);
    await saveRefreshTokenInRedis(authId, refreshToken);

    return {
      accessToken,
      refreshToken,
    };
  }

  async registerLocal(req: AuthLocalReq): Promise<TokenPair> {
    const { username, password } = req;
    const existingAuth = await this.authRepository.findByProviderAndProviderId(
      UserAuthProvider.LOCAL,
      username,
    );

    if (existingAuth) {
      throw new AppError(
        AppErrorMessage.USER_ALREADY_EXISTS,
        409,
        AppErrorCode.USER_ALREADY_EXISTS,
      );
    }

    const hashedPassword = await bcrypt.hash(password, this.SALT_ROUNDS); //CPU를 좀 많이 쓰는 작업임.
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const auth = await this.authRepository.create(
        UserAuthProvider.LOCAL,
        username,
        hashedPassword,
      );
      await queryRunner.commitTransaction();

      const tokenPair = await this.generateAndStoreTokens(auth.id);

      return {
        authId: auth.id,
        accessToken: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();

      const dbError = error as { code?: string };

      if (dbError.code === '23505') {
        throw new AppError(
          AppErrorMessage.USER_ALREADY_EXISTS,
          409,
          AppErrorCode.USER_ALREADY_EXISTS,
        );
      }
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async loginLocal(req: AuthLocalReq): Promise<TokenPair> {
    const { username, password } = req;

    const auth = await this.authRepository.findByProviderIdWithPassword(
      UserAuthProvider.LOCAL,
      username,
    );
    if (!auth) {
      throw new AppError(AppErrorMessage.FAILED_LOGIN, 401, AppErrorCode.FAILED_LOGIN);
    }

    const isPwValid = await bcrypt.compare(password, auth.password || '');
    if (!isPwValid) {
      throw new AppError(AppErrorMessage.FAILED_LOGIN, 401, AppErrorCode.FAILED_LOGIN);
    }

    const tokenPair = await this.generateAndStoreTokens(auth.id);

    return {
      authId: auth.id,
      accessToken: tokenPair.accessToken,
      refreshToken: tokenPair.refreshToken,
    };
  }

  async logout(authId: string): Promise<void> {
    await deleteRefreshTokenInRedis(authId);
  }

  async softDeleteAuth(authId: string): Promise<void> {
    const auth = await this.authRepository.findByIdWithDeleted(authId);
    if (!auth) {
      throw new AppError(AppErrorMessage.USER_NOT_FOUND, 404, AppErrorCode.USER_NOT_FOUND);
    }

    if (auth.deletedAt) {
      throw new AppError(
        AppErrorMessage.USER_ALREADY_DELETED,
        409,
        AppErrorCode.USER_ALREADY_DELETED,
      );
    }

    await this.authRepository.softDelete(authId);
    await deleteRefreshTokenInRedis(authId);
  }

  async startRefreshTokenFlow(tokenFromCookie: string): Promise<{ accessToken: string }> {
    const payload = verifyToken('refresh', tokenFromCookie);
    if (!payload) {
      throw new AppError(AppErrorMessage.RT_MISSING, 401, AppErrorCode.RT_MISSING);
    }

    const isMatched = await verifyRefreshTokenInRedis(payload.authId, tokenFromCookie);
    if (!isMatched) {
      throw new AppError(AppErrorMessage.RT_MISSING, 401, AppErrorCode.RT_MISSING);
    }

    const newAccessToken = generateAccessToken(payload.authId);

    return { accessToken: newAccessToken };
  }
}
