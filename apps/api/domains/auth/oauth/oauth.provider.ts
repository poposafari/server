import { createRemoteJWKSet, jwtVerify } from 'jose';
import { envConfig } from '@poposerver/lib/utils/env';
import { AppError } from '@poposerver/lib/utils/error';
import { AppErrorCode, AppErrorMessage } from '@poposerver/lib/types';
import { logger } from '@poposerver/lib/utils/logger';
import type { OAuthProviderName } from '@poposerver/lib/state';

export interface OAuthUserInfo {
  providerId: string;
  email?: string;
}

export interface OAuthProvider {
  name: OAuthProviderName;
  buildAuthorizeUrl(state: string): string;
  exchangeCode(code: string): Promise<OAuthUserInfo>;
}

const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

export class GoogleOAuthProvider implements OAuthProvider {
  readonly name = 'google' as const;

  buildAuthorizeUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: envConfig.OAUTH_GOOGLE_CLIENT_ID,
      redirect_uri: envConfig.OAUTH_GOOGLE_REDIRECT_URI,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      prompt: 'select_account',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<OAuthUserInfo> {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: envConfig.OAUTH_GOOGLE_CLIENT_ID,
        client_secret: envConfig.OAUTH_GOOGLE_CLIENT_SECRET,
        redirect_uri: envConfig.OAUTH_GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) {
      const body = await tokenRes.text().catch(() => '<unreadable>');
      logger.warn(`[oauth/google] token exchange failed: ${tokenRes.status} ${body}`);
      throw new AppError(
        AppErrorMessage.OAUTH_TOKEN_FAILED,
        401,
        AppErrorCode.OAUTH_TOKEN_FAILED,
      );
    }

    const tokenJson = (await tokenRes.json()) as { id_token?: string };
    if (!tokenJson.id_token) {
      throw new AppError(
        AppErrorMessage.OAUTH_TOKEN_FAILED,
        401,
        AppErrorCode.OAUTH_TOKEN_FAILED,
      );
    }

    let payload;
    try {
      const verified = await jwtVerify(tokenJson.id_token, GOOGLE_JWKS, {
        issuer: ['https://accounts.google.com', 'accounts.google.com'],
        audience: envConfig.OAUTH_GOOGLE_CLIENT_ID,
      });
      payload = verified.payload;
    } catch {
      throw new AppError(
        AppErrorMessage.OAUTH_TOKEN_FAILED,
        401,
        AppErrorCode.OAUTH_TOKEN_FAILED,
      );
    }

    const sub = typeof payload.sub === 'string' ? payload.sub : '';
    if (!sub) {
      throw new AppError(
        AppErrorMessage.OAUTH_USERINFO_FAILED,
        401,
        AppErrorCode.OAUTH_USERINFO_FAILED,
      );
    }
    const email = typeof payload.email === 'string' ? payload.email : undefined;
    return { providerId: sub, email };
  }
}

export class DiscordOAuthProvider implements OAuthProvider {
  readonly name = 'discord' as const;

  buildAuthorizeUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: envConfig.OAUTH_DISCORD_CLIENT_ID,
      redirect_uri: envConfig.OAUTH_DISCORD_REDIRECT_URI,
      response_type: 'code',
      scope: 'identify email',
      state,
      prompt: 'consent',
    });
    return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<OAuthUserInfo> {
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: envConfig.OAUTH_DISCORD_CLIENT_ID,
        client_secret: envConfig.OAUTH_DISCORD_CLIENT_SECRET,
        redirect_uri: envConfig.OAUTH_DISCORD_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) {
      const body = await tokenRes.text().catch(() => '<unreadable>');
      logger.warn(`[oauth/discord] token exchange failed: ${tokenRes.status} ${body}`);
      throw new AppError(
        AppErrorMessage.OAUTH_TOKEN_FAILED,
        401,
        AppErrorCode.OAUTH_TOKEN_FAILED,
      );
    }
    const tokenJson = (await tokenRes.json()) as { access_token?: string };
    if (!tokenJson.access_token) {
      throw new AppError(
        AppErrorMessage.OAUTH_TOKEN_FAILED,
        401,
        AppErrorCode.OAUTH_TOKEN_FAILED,
      );
    }

    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });
    if (!userRes.ok) {
      throw new AppError(
        AppErrorMessage.OAUTH_USERINFO_FAILED,
        401,
        AppErrorCode.OAUTH_USERINFO_FAILED,
      );
    }
    const user = (await userRes.json()) as { id?: string; email?: string };
    if (!user.id) {
      throw new AppError(
        AppErrorMessage.OAUTH_USERINFO_FAILED,
        401,
        AppErrorCode.OAUTH_USERINFO_FAILED,
      );
    }
    return { providerId: user.id, email: user.email };
  }
}

export const oauthProviders: Record<OAuthProviderName, OAuthProvider> = {
  google: new GoogleOAuthProvider(),
  discord: new DiscordOAuthProvider(),
};

export function isOAuthProviderName(value: string): value is OAuthProviderName {
  return value === 'google' || value === 'discord';
}
