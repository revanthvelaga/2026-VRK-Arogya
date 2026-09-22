import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

export interface GoogleProfile {
  email: string;
  name?: string;
}

// "Sign in with Google" (Google Identity Services) hands the frontend an
// ID token directly — no OAuth code exchange, no client secret. Verifying
// it here only needs the same public Client ID the frontend uses to ask
// for the token in the first place; Google's library checks the token's
// signature against Google's own public keys and confirms the audience
// matches our client ID.
@Injectable()
export class GoogleAuthService {
  private readonly client: OAuth2Client;
  private readonly clientId?: string;

  constructor(private readonly config: ConfigService) {
    this.clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    this.client = new OAuth2Client(this.clientId);
  }

  async verify(idToken: string): Promise<GoogleProfile> {
    if (!this.clientId) {
      throw new UnauthorizedException('Google sign-in is not configured on this server (missing GOOGLE_CLIENT_ID)');
    }

    let payload;
    try {
      const ticket = await this.client.verifyIdToken({ idToken, audience: this.clientId });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Invalid Google sign-in token');
    }

    if (!payload?.email) {
      throw new UnauthorizedException('That Google account has no email address');
    }

    return { email: payload.email, name: payload.name };
  }
}
