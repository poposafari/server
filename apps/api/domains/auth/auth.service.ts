import bcrypt from 'bcrypt';
import { AppError } from '@poposerver/lib/utils/error';
import { AppErrorCode, AppErrorMessage } from '@poposerver/lib/types';
import { UserAuthProvider } from '@poposerver/lib/types';
import {
  createSession,
  deleteSession,
  deleteUserState,
  getSession,
  isActivePlayer,
  publishSocketKick,
} from '@poposerver/lib/redis';
import { AuthRepository } from './auth.repository';
import { AuthLocalInput, LoginLocalInput } from './auth.schema';

const SALT_ROUNDS = 10;

export class AuthService {
  constructor(private readonly repo: AuthRepository) {}

  async registerLocal(input: AuthLocalInput): Promise<{ sessionId: string; accountId: number }> {
    const existing = await this.repo.findByProviderAndProviderId(
      UserAuthProvider.LOCAL,
      input.username,
    );
    if (existing) {
      throw new AppError(
        AppErrorMessage.ACCOUNT_ALREADY_EXIST,
        409,
        AppErrorCode.ACCOUNT_ALREADY_EXIST,
      );
    }

    const hashedPassword = await bcrypt.hash(input.password, SALT_ROUNDS);

    let authRow;
    try {
      authRow = await this.repo.create(UserAuthProvider.LOCAL, input.username, hashedPassword);
    } catch (error) {
      const dbError = error as { code?: string };
      if (dbError.code === '23505') {
        throw new AppError(
          AppErrorMessage.ACCOUNT_ALREADY_EXIST,
          409,
          AppErrorCode.ACCOUNT_ALREADY_EXIST,
        );
      }
      throw error;
    }

    const sessionId = await createSession(String(authRow.id));
    return { sessionId, accountId: authRow.id };
  }

  async loginOrCreateOAuth(
    provider: 'google' | 'discord',
    providerId: string,
  ): Promise<{ sessionId: string; accountId: number }> {
    const existing = await this.repo.findByProviderAndProviderId(provider, providerId);

    if (existing?.deletedAt) {
      throw new AppError(
        AppErrorMessage.ACCOUNT_ALREADY_DELETED,
        401,
        AppErrorCode.ACCOUNT_ALREADY_DELETED,
      );
    }

    let authId: number;
    if (existing) {
      authId = existing.id;
    } else {
      try {
        const created = await this.repo.createOAuth(provider, providerId);
        authId = created.id;
      } catch (error) {
        const dbError = error as { code?: string };
        if (dbError.code === '23505') {
          const retry = await this.repo.findByProviderAndProviderId(provider, providerId);
          if (!retry || retry.deletedAt) {
            throw new AppError(
              AppErrorMessage.ACCOUNT_ALREADY_DELETED,
              401,
              AppErrorCode.ACCOUNT_ALREADY_DELETED,
            );
          }
          authId = retry.id;
        } else {
          throw error;
        }
      }
    }

    // 기존 접속자 킥은 여기서 하지 않음.
    // POST /api/game/connect (토큰 발급) 시점에서 처리. (loginLocal과 동일)
    const sessionId = await createSession(String(authId));
    await this.repo.updateLastLoginAt(authId);
    return { sessionId, accountId: authId };
  }

  async loginLocal(input: LoginLocalInput): Promise<{ sessionId: string; accountId: number }> {
    const auth = await this.repo.findActiveByProviderIdWithPassword(
      UserAuthProvider.LOCAL,
      input.username,
    );
    if (!auth) {
      throw new AppError(AppErrorMessage.FAILED_ACCOUNT, 401, AppErrorCode.FAILED_ACCOUNT);
    }

    const isValid = await bcrypt.compare(input.password, auth.password || '');
    if (!isValid) {
      throw new AppError(AppErrorMessage.FAILED_ACCOUNT, 401, AppErrorCode.FAILED_ACCOUNT);
    }

    const authId = String(auth.id);

    // 기존 접속자 킥은 여기서 하지 않음.
    // POST /api/game/connect (토큰 발급) 시점에서 처리.

    const sessionId = await createSession(authId);
    await this.repo.updateLastLoginAt(auth.id);

    return { sessionId, accountId: auth.id };
  }

  async invalidateSession(sessionId: string): Promise<void> {
    await deleteSession(sessionId);
  }

  async logout(sessionId: string): Promise<void> {
    const session = await getSession(sessionId);
    await deleteSession(sessionId);
    if (session) {
      await publishSocketKick(session.authId);
      await deleteUserState(session.authId);
    }
  }

  async softDeleteAuth(authId: string, sessionId: string): Promise<void> {
    const numericId = Number(authId);
    const auth = await this.repo.findByIdIncludeDeleted(numericId);
    if (!auth) {
      throw new AppError(AppErrorMessage.NOT_FOUND, 404, AppErrorCode.NOT_FOUND);
    }
    if (auth.deletedAt) {
      throw new AppError(
        AppErrorMessage.ACCOUNT_ALREADY_DELETED,
        409,
        AppErrorCode.ACCOUNT_ALREADY_DELETED,
      );
    }

    if (await isActivePlayer(authId)) {
      throw new AppError(AppErrorMessage.ACCOUNT_IN_USE, 409, AppErrorCode.ACCOUNT_IN_USE);
    }

    await this.repo.softDelete(numericId);
    await deleteSession(sessionId);
    await publishSocketKick(authId);
    await deleteUserState(authId);
  }
}
