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
      throw new AppError(AppErrorMessage.USER_ALREADY_EXISTS, 409, AppErrorCode.CONFLICT);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const hashedPassword = await bcrypt.hash(password, this.SALT_ROUNDS);
      const auth = await this.authRepository.create(
        UserAuthProvider.LOCAL,
        username,
        hashedPassword,
      );
      const tokenPair = await this.generateAndStoreTokens(auth.id);
      await queryRunner.commitTransaction();

      return {
        accessToken: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
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
      throw new AppError(AppErrorMessage.INVALID_CREDENTIALS, 401, AppErrorCode.UNAUTHORIZED);
    }

    const isPwValid = await bcrypt.compare(password, auth.password || '');
    if (!isPwValid) {
      throw new AppError(AppErrorMessage.INVALID_CREDENTIALS, 401, AppErrorCode.UNAUTHORIZED);
    }

    const tokenPair = await this.generateAndStoreTokens(auth.id);

    return {
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
      throw new AppError(AppErrorMessage.NOT_FOUND, 404, AppErrorCode.NOT_FOUND);
    }

    if (auth.deletedAt) {
      throw new AppError(AppErrorMessage.USER_ALREADY_DELETED, 409, AppErrorCode.CONFLICT);
    }

    await this.authRepository.softDelete(authId);
    await deleteRefreshTokenInRedis(authId);
  }

  async startRefreshTokenFlow(tokenFromCookie: string): Promise<{ accessToken: string }> {
    const payload = verifyToken('refresh', tokenFromCookie);
    if (!payload) {
      throw new AppError(AppErrorMessage.INVALID_CREDENTIALS, 401, AppErrorCode.UNAUTHORIZED);
    }

    const isMatched = await verifyRefreshTokenInRedis(payload.authId, tokenFromCookie);
    if (!isMatched) {
      throw new AppError(AppErrorMessage.INVALID_CREDENTIALS, 401, AppErrorCode.UNAUTHORIZED);
    }

    const newAccessToken = generateAccessToken(payload.authId);

    return { accessToken: newAccessToken };
  }
}
