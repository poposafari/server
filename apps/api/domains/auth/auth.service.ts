import bcrypt from 'bcrypt';
import {
  AppError,
  AppErrorCode,
  deleteRefreshTokenInRedis,
  generateAccessToken,
  generateTokenPair,
  saveRefreshTokenInRedis,
  TokenPair,
  UserAuthProvider,
  verifyRefreshTokenInRedis,
  verifyToken,
} from 'shared';
import { AuthLocalReq } from './auth.dto';
import { AuthRepository } from './auth.repository';

export class AuthService {
  private readonly SALT_ROUNDS = 10;

  constructor(private readonly authRepository: AuthRepository) {}

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
      throw new AppError('User already exists', 409, AppErrorCode.CONFLICT);
    }

    const hashedPassword = await bcrypt.hash(password, this.SALT_ROUNDS);
    const auth = await this.authRepository.create(UserAuthProvider.LOCAL, username, hashedPassword);
    const tokenPair = await this.generateAndStoreTokens(auth.id);

    return {
      accessToken: tokenPair.accessToken,
      refreshToken: tokenPair.refreshToken,
    };
  }

  async loginLocal(req: AuthLocalReq): Promise<TokenPair> {
    const { username, password } = req;

    const auth = await this.authRepository.findByProviderIdWithPassword(
      UserAuthProvider.LOCAL,
      username,
    );
    if (!auth) {
      console.error('Invalid credentials: User not found');
      throw new AppError('Invalid credentials', 401, AppErrorCode.UNAUTHORIZED);
    }

    const isPwValid = await bcrypt.compare(password, auth.password || '');
    if (!isPwValid) {
      console.error('Invalid credentials: Password does not match');
      throw new AppError('Invalid credentials', 401, AppErrorCode.UNAUTHORIZED);
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
      throw new AppError('User not found', 404, AppErrorCode.NOT_FOUND);
    }

    if (auth.deletedAt) {
      throw new AppError('User already deleted', 409, AppErrorCode.CONFLICT);
    }

    await this.authRepository.softDelete(authId);
    await deleteRefreshTokenInRedis(authId);
  }

  async startRefreshTokenFlow(tokenFromCookie: string): Promise<{ accessToken: string }> {
    const payload = verifyToken('refresh', tokenFromCookie);
    if (!payload) {
      throw new AppError('Invalid refresh token', 401, AppErrorCode.RT_EXPIRED);
    }

    const isMatched = await verifyRefreshTokenInRedis(payload.authId, tokenFromCookie);
    if (!isMatched) {
      throw new AppError('Session expired or invalid', 401, AppErrorCode.RT_EXPIRED);
    }

    const newAccessToken = generateAccessToken(payload.authId);

    return { accessToken: newAccessToken };
  }
}
