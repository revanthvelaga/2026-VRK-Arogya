import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

export interface FirebasePhoneProfile {
  phone: string;
}

// Firebase's SMS-OTP flow (RecaptchaVerifier + signInWithPhoneNumber on
// the frontend) hands back a Firebase ID token once the code is
// verified. That token is a standard RS256 JWT signed by Google, so it
// can be checked here with nothing more than the (non-secret) Firebase
// project id — no service account key, no firebase-admin credential,
// just the same public JWKS endpoint every Firebase project shares.
const FIREBASE_JWKS_URI = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

// India-only app — Firebase hands back E.164 ("+919876543210"); every
// other part of Arogya stores/expects the bare 10-digit number.
function normalizeIndianPhone(e164: string): string {
  return e164.replace(/\D/g, '').slice(-10);
}

@Injectable()
export class FirebasePhoneAuthService {
  private readonly projectId?: string;
  private readonly jwks = jwksClient({
    jwksUri: FIREBASE_JWKS_URI,
    cache: true,
    cacheMaxAge: 12 * 60 * 60 * 1000, // 12h — these keys rotate infrequently
  });

  constructor(private readonly config: ConfigService) {
    this.projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
  }

  private getKey = (header: jwt.JwtHeader, callback: (err: Error | null, key?: string) => void) => {
    this.jwks.getSigningKey(header.kid, (err, key) => {
      if (err || !key) {
        callback(err ?? new Error('Signing key not found'));
        return;
      }
      callback(null, key.getPublicKey());
    });
  };

  async verify(idToken: string): Promise<FirebasePhoneProfile> {
    if (!this.projectId) {
      throw new UnauthorizedException(
        'Mobile OTP sign-in is not configured on this server (missing FIREBASE_PROJECT_ID)',
      );
    }

    let decoded: jwt.JwtPayload;
    try {
      decoded = await new Promise<jwt.JwtPayload>((resolve, reject) => {
        jwt.verify(
          idToken,
          this.getKey,
          {
            algorithms: ['RS256'],
            issuer: `https://securetoken.google.com/${this.projectId}`,
            audience: this.projectId,
          },
          (err, payload) => {
            if (err || !payload || typeof payload === 'string') {
              reject(err ?? new Error('Invalid token'));
              return;
            }
            resolve(payload);
          },
        );
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired OTP sign-in token');
    }

    const phoneNumber = decoded.phone_number as string | undefined;
    if (!phoneNumber) {
      throw new UnauthorizedException('That sign-in token has no verified phone number');
    }

    return { phone: normalizeIndianPhone(phoneNumber) };
  }
}
