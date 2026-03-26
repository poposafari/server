import { db } from '@poposerver/lib/db';
import { account } from '@poposerver/lib/schema';
import { eq, and, isNull } from 'drizzle-orm';

export class AuthRepository {
  /** 삭제된 계정 포함 조회 (회원가입 중복 체크용) */
  async findByProviderAndProviderId(provider: string, providerId: string) {
    const [row] = await db
      .select()
      .from(account)
      .where(and(eq(account.provider, provider), eq(account.providerId, providerId)))
      .limit(1);
    return row ?? null;
  }

  /** 비밀번호 포함 조회 (로그인용, 삭제된 계정 제외) */
  async findActiveByProviderIdWithPassword(provider: string, providerId: string) {
    const [row] = await db
      .select({
        id: account.id,
        password: account.password,
      })
      .from(account)
      .where(
        and(
          eq(account.provider, provider),
          eq(account.providerId, providerId),
          isNull(account.deletedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async create(provider: string, providerId: string, hashedPassword: string) {
    const [row] = await db
      .insert(account)
      .values({ provider, providerId, password: hashedPassword })
      .returning({ id: account.id });
    return row;
  }

  async updateLastLoginAt(authId: number) {
    await db
      .update(account)
      .set({ lastLoginAt: new Date() })
      .where(eq(account.id, authId));
  }

  async softDelete(authId: number) {
    await db
      .update(account)
      .set({ deletedAt: new Date() })
      .where(eq(account.id, authId));
  }

  /** deletedAt 포함 조회 (탈퇴 시 이미 삭제됐는지 확인용) */
  async findByIdIncludeDeleted(authId: number) {
    const [row] = await db
      .select()
      .from(account)
      .where(eq(account.id, authId))
      .limit(1);
    return row ?? null;
  }
}
