import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type { AuthenticationResponseJSON, AuthenticatorTransportFuture, RegistrationResponseJSON } from '@simplewebauthn/server';
import { Passkey } from './entities/passkey.entity';
import { UsersService } from '../users/users.service';

// Passkey sign-in: the customer proves their number once (OTP or Google),
// saves a passkey, and from then on signs in with fingerprint / face /
// screen lock — no code, so no per-login SMS or WhatsApp cost.
//
// The challenge is not stored server-side: it travels to the browser and
// back inside a short-lived signed token, so this works across restarts
// and multiple instances without a table for pending challenges.

const CHALLENGE_TTL_SECONDS = 5 * 60;
const DEFAULT_ORIGINS = 'https://arogya-customer-web.onrender.com,http://localhost:5173';

interface ChallengeToken {
  ch: string; // the challenge, base64url
  p: 'reg' | 'auth';
  uid?: string; // registration only: whose passkey this is
  o: string; // origin the ceremony started from
}

@Injectable()
export class PasskeyService {
  constructor(
    @InjectRepository(Passkey) private readonly passkeys: Repository<Passkey>,
    private readonly usersService: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // Passkeys are bound to the website's domain, so only origins we know
  // may start a ceremony; the RP ID is that origin's host name.
  private resolveOrigin(origin: string | undefined): { origin: string; rpID: string } {
    const allowed = (this.config.get<string>('WEBAUTHN_ORIGINS') ?? DEFAULT_ORIGINS)
      .split(',')
      .map((o) => o.trim().replace(/\/$/, ''))
      .filter(Boolean);
    const o = (origin ?? '').replace(/\/$/, '');
    if (!o || !allowed.includes(o)) {
      throw new BadRequestException('Fingerprint sign-in is not available on this site.');
    }
    return { origin: o, rpID: new URL(o).hostname };
  }

  private signChallenge(t: ChallengeToken): string {
    return this.jwt.sign(t, { secret: this.challengeSecret(), expiresIn: CHALLENGE_TTL_SECONDS });
  }

  private readChallenge(token: string, purpose: ChallengeToken['p']): ChallengeToken {
    try {
      const t = this.jwt.verify<ChallengeToken>(token, { secret: this.challengeSecret() });
      if (t.p !== purpose) throw new Error('wrong purpose');
      return t;
    } catch {
      throw new UnauthorizedException('That took too long — please try again.');
    }
  }

  private challengeSecret(): string {
    // Separate from the session secrets so a challenge token can never pass as a session.
    return `${this.config.get<string>('JWT_ACCESS_SECRET')}:webauthn`;
  }

  // ---- Saving a passkey (signed in) --------------------------------------

  async registrationOptions(userId: string, originHeader?: string) {
    const { origin, rpID } = this.resolveOrigin(originHeader);
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('Account not found');
    const existing = await this.passkeys.find({ where: { userId } });

    const options = await generateRegistrationOptions({
      rpName: 'Arogya',
      rpID,
      userID: new TextEncoder().encode(user.id),
      userName: user.phone ?? user.email ?? user.id,
      userDisplayName: user.fullName ?? user.phone ?? 'Arogya customer',
      attestationType: 'none',
      // Don't save a second passkey on a device that already has one.
      excludeCredentials: existing.map((p) => ({
        id: p.credentialId,
        transports: (p.transports ?? undefined) as AuthenticatorTransportFuture[] | undefined,
      })),
      authenticatorSelection: {
        // Discoverable, so sign-in needs no phone number typed first.
        residentKey: 'required',
        userVerification: 'preferred',
      },
    });

    return {
      options,
      challengeToken: this.signChallenge({ ch: options.challenge, p: 'reg', uid: userId, o: origin }),
    };
  }

  async verifyRegistration(userId: string, challengeToken: string, response: RegistrationResponseJSON, deviceName?: string) {
    const t = this.readChallenge(challengeToken, 'reg');
    if (t.uid !== userId) throw new UnauthorizedException('Please try again.');

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: t.ch,
        expectedOrigin: t.o,
        expectedRPID: new URL(t.o).hostname,
        requireUserVerification: false,
      });
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : 'Could not save the passkey.');
    }
    if (!verification.verified || !verification.registrationInfo) {
      throw new BadRequestException('Could not save the passkey.');
    }

    const { credential } = verification.registrationInfo;
    const saved = await this.passkeys.save(
      this.passkeys.create({
        userId,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey).toString('base64url'),
        counter: String(credential.counter ?? 0),
        transports: credential.transports ?? null,
        deviceName: (deviceName ?? '').trim().slice(0, 80) || 'This device',
      }),
    );
    return this.toView(saved);
  }

  // ---- Signing in with a passkey (public) --------------------------------

  async authenticationOptions(originHeader?: string) {
    const { origin, rpID } = this.resolveOrigin(originHeader);
    const options = await generateAuthenticationOptions({ rpID, userVerification: 'preferred' });
    return { options, challengeToken: this.signChallenge({ ch: options.challenge, p: 'auth', o: origin }) };
  }

  // Returns the user id the passkey belongs to; the caller issues the session.
  async verifyAuthentication(challengeToken: string, response: AuthenticationResponseJSON): Promise<string> {
    const t = this.readChallenge(challengeToken, 'auth');
    const passkey = await this.passkeys.findOne({ where: { credentialId: response.id } });
    if (!passkey) {
      throw new UnauthorizedException('This passkey is no longer linked to an Arogya account. Sign in with OTP and set it up again.');
    }

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: t.ch,
        expectedOrigin: t.o,
        expectedRPID: new URL(t.o).hostname,
        requireUserVerification: false,
        credential: {
          id: passkey.credentialId,
          publicKey: new Uint8Array(Buffer.from(passkey.publicKey, 'base64url')),
          counter: Number(passkey.counter),
          transports: (passkey.transports ?? undefined) as AuthenticatorTransportFuture[] | undefined,
        },
      });
    } catch {
      throw new UnauthorizedException('Fingerprint sign-in failed. Please try again.');
    }
    if (!verification.verified) throw new UnauthorizedException('Fingerprint sign-in failed. Please try again.');

    passkey.counter = String(verification.authenticationInfo.newCounter);
    passkey.lastUsedAt = new Date();
    await this.passkeys.save(passkey);
    return passkey.userId;
  }

  // ---- Managing saved passkeys -------------------------------------------

  async list(userId: string) {
    const rows = await this.passkeys.find({ where: { userId }, order: { createdAt: 'DESC' } });
    return rows.map((p) => this.toView(p));
  }

  async remove(userId: string, id: string) {
    const res = await this.passkeys.delete({ id, userId });
    if (!res.affected) throw new NotFoundException('Passkey not found');
    return { ok: true };
  }

  private toView(p: Passkey) {
    return { id: p.id, deviceName: p.deviceName, createdAt: p.createdAt, lastUsedAt: p.lastUsedAt };
  }
}
