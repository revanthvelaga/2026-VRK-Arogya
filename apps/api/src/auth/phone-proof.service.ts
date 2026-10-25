import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

// After the server has checked a WhatsApp code, the server hands back this short-lived
// signed note ("this browser proved it owns phone X"). It plays the part
// Firebase's ID token plays: the sign-in, "finish sign-up with a name" and
// "reset password" steps can each use it, without the one-time code being
// checked (and burned) a second time. Signed with its own secret, derived
// from the access secret, so it can never be mistaken for a login token.
const PREFIX = 'proof:';
const PROOF_MINUTES = 10;

@Injectable()
export class PhoneProofService {
  constructor(private readonly config: ConfigService) {}

  private get secret() {
    return `${this.config.get<string>('JWT_ACCESS_SECRET')}::phone-proof`;
  }

  static isProof(token: string): boolean {
    return token.startsWith(PREFIX);
  }

  issue(phone: string): string {
    return PREFIX + jwt.sign({ phone, use: 'phone-proof' }, this.secret, { expiresIn: `${PROOF_MINUTES}m` });
  }

  verify(token: string): { phone: string } {
    try {
      const payload = jwt.verify(token.slice(PREFIX.length), this.secret, { algorithms: ['HS256'] }) as jwt.JwtPayload;
      if (payload.use !== 'phone-proof' || typeof payload.phone !== 'string') throw new Error('wrong token');
      return { phone: payload.phone };
    } catch {
      throw new UnauthorizedException('Your OTP check has expired. Please request a new code.');
    }
  }
}
