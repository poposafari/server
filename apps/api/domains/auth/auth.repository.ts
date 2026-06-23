import { db } from '@poposerver/lib/db';
import { account } from '@poposerver/lib/schema';
import { eq, and } from 'drizzle-orm';

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

  async findByProviderIdWithPassword(provider: string, providerId: string) {
    const [row] = await db
      .select({
        id: account.id,
        password: account.password,
        deletedAt: account.deletedAt,
      })
      .from(account)
      .where(and(eq(account.provider, provider), eq(account.providerId, providerId)))
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

  async createOAuth(provider: string, providerId: string) {
    const [row] = await db
      .insert(account)
      .values({ provider, providerId, password: null })
      .returning({ id: account.id });
    return row;
  }

  async updateLastLoginAt(authId: number) {
    await db.update(account).set({ lastLoginAt: new Date() }).where(eq(account.id, authId));
  }

  async softDelete(authId: number) {
    await db.update(account).set({ deletedAt: new Date() }).where(eq(account.id, authId));
  }

  /** deletedAt 포함 조회 (탈퇴 시 이미 삭제됐는지 확인용) */
  async findByIdIncludeDeleted(authId: number) {
    const [row] = await db.select().from(account).where(eq(account.id, authId)).limit(1);
    return row ?? null;
  }
}
