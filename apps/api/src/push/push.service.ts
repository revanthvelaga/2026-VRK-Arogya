import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as jwt from 'jsonwebtoken';
import { DeviceToken } from './device-token.entity';

// Push notifications through Firebase Cloud Messaging (FCM HTTP v1).
//
// Everything happens here on the server: the Android app only ever hands
// us its registration token. The Google service-account key that lets us
// send lives in the FCM_SERVICE_ACCOUNT_JSON setting (raw JSON, or the
// same JSON base64-encoded) and is never shipped in the app. Without it,
// push is simply off and nothing else changes.
//
// Delivery is best-effort: a phone that is offline, switched off or has
// notifications blocked just doesn't get it. The same message is always
// stored in the in-app bell, which is the source of truth.

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
  token_uri?: string;
}

export interface PushMessage {
  title: string;
  body: string;
  // Delivered to the app as strings (FCM requirement); `route` is the page
  // the app opens when the notification is tapped.
  data: Record<string, string>;
}

const MAX_TOKENS_PER_USER = 10;
const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
// Must match the channel the Android app creates.
const ANDROID_CHANNEL_ID = 'arogya_updates';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private account: ServiceAccount | null | undefined;
  private cachedAccessToken: { value: string; expiresAt: number } | null = null;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(DeviceToken) private readonly tokens: Repository<DeviceToken>,
  ) {}

  private loadAccount(): ServiceAccount | null {
    if (this.account !== undefined) return this.account;
    const raw = this.config.get<string>('FCM_SERVICE_ACCOUNT_JSON')?.trim();
    this.account = null;
    if (!raw) return null;
    try {
      const text = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
      const parsed = JSON.parse(text) as ServiceAccount;
      if (parsed.project_id && parsed.client_email && parsed.private_key) {
        // Env vars often carry the key's line breaks as literal "\n".
        this.account = { ...parsed, private_key: parsed.private_key.replace(/\\n/g, '\n') };
      } else {
        this.logger.warn('FCM_SERVICE_ACCOUNT_JSON is missing project_id, client_email or private_key — push is off');
      }
    } catch {
      this.logger.warn('FCM_SERVICE_ACCOUNT_JSON could not be read — push is off');
    }
    return this.account;
  }

  isConfigured(): boolean {
    return this.loadAccount() != null;
  }

  // ---- Device registration (called by the signed-in app) ----

  async register(userId: string, token: string, platform: string): Promise<void> {
    await this.tokens.upsert({ userId, token, platform }, ['token']);
    // Keep the newest few per user; old phones that were replaced fall off.
    const rows = await this.tokens.find({ where: { userId }, order: { updatedAt: 'DESC' } });
    if (rows.length > MAX_TOKENS_PER_USER) {
      await this.tokens.delete(rows.slice(MAX_TOKENS_PER_USER).map((r) => r.id));
    }
  }

  async unregister(token: string): Promise<void> {
    await this.tokens.delete({ token });
  }

  // ---- Sending ----

  private async accessToken(account: ServiceAccount): Promise<string> {
    if (this.cachedAccessToken && this.cachedAccessToken.expiresAt - Date.now() > 5 * 60_000) {
      return this.cachedAccessToken.value;
    }
    const tokenUri = account.token_uri ?? 'https://oauth2.googleapis.com/token';
    const now = Math.floor(Date.now() / 1000);
    const assertion = jwt.sign({ iss: account.client_email, scope: FCM_SCOPE, aud: tokenUri, iat: now, exp: now + 3600 }, account.private_key, {
      algorithm: 'RS256',
    });
    const res = await fetch(tokenUri, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number };
    if (!res.ok || !body.access_token) throw new Error(`Google sign-in for FCM failed (HTTP ${res.status})`);
    this.cachedAccessToken = { value: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 };
    return body.access_token;
  }

  // Sends to every phone this user is signed in on. Never throws: a push
  // problem must not fail the booking, report or status change behind it.
  async sendToUser(userId: string, message: PushMessage): Promise<void> {
    try {
      const account = this.loadAccount();
      if (!account) return;
      const devices = await this.tokens.find({ where: { userId } });
      if (!devices.length) return;
      const accessToken = await this.accessToken(account);
      const base = (this.config.get<string>('FCM_BASE_URL') ?? 'https://fcm.googleapis.com').replace(/\/$/, '');
      await Promise.all(devices.map((d) => this.sendOne(base, account, accessToken, d, message)));
    } catch (err) {
      this.logger.warn(`Push to user failed: ${(err as Error).message}`);
    }
  }

  private async sendOne(base: string, account: ServiceAccount, accessToken: string, device: DeviceToken, message: PushMessage) {
    try {
      const res = await fetch(`${base}/v1/projects/${account.project_id}/messages:send`, {
        method: 'POST',
        headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          message: {
            token: device.token,
            notification: { title: message.title, body: message.body },
            data: message.data,
            android: { priority: 'HIGH', notification: { channel_id: ANDROID_CHANNEL_ID } },
          },
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) return;
      const err = (await res.json().catch(() => ({}))) as { error?: { status?: string; message?: string } };
      const status = err.error?.status;
      // The phone uninstalled the app or the token was replaced: forget it.
      if (status === 'UNREGISTERED' || status === 'NOT_FOUND' || (status === 'INVALID_ARGUMENT' && /registration token/i.test(err.error?.message ?? ''))) {
        await this.tokens.delete({ id: device.id });
        return;
      }
      if (res.status === 401) this.cachedAccessToken = null;
      this.logger.warn(`FCM send failed (HTTP ${res.status} ${status ?? ''})`);
    } catch (err) {
      this.logger.warn(`FCM send failed: ${(err as Error).message}`);
    }
  }
}
