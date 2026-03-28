import bcrypt from 'bcrypt';
import { AppError } from '@poposerver/lib/utils/error';
import { AppErrorCode, AppErrorMessage } from '@poposerver/lib/types';
import { UserAuthProvider } from '@poposerver/lib/types';
import {
  createSession,
  deleteSession,
  deleteUserState,
  getSession,
  publishSocketKick,
} from '@poposerver/lib/redis';
import { AuthRepository } from './auth.repository';
import { AuthLocalInput } from './auth.schema';

const SALT_ROUNDS = 10;

export class AuthService {
  constructor(private readonly repo: AuthRepository) {}

  async registerLocal(input: AuthLocalInput): Promise<string> {
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
    return sessionId;
  }

  async loginLocal(input: AuthLocalInput): Promise<string> {
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
    await publishSocketKick(authId);

    const sessionId = await createSession(authId);
    await this.repo.updateLastLoginAt(auth.id);

    return sessionId;
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

    await this.repo.softDelete(numericId);
    await deleteSession(sessionId);
    await publishSocketKick(authId);
    await deleteUserState(authId);
  }
}
