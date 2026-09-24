import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransport,
  RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { Passkey } from './entities/passkey.entity';
import { UsersService } from '../users/users.service';

const CHALLENGE_TTL_MS = 5 * 60_000;

// Origins that may register and use passkeys. The RP ID is the page's
// own hostname (the customer site, not this API), so a passkey only ever
// works on the site it was made on. Overridable with WEBAUTHN_ORIGINS.
const DEFAULT_ORIGINS = [
  'https://arogya-customer-web.onrender.com',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5184',
];

interface PendingChallenge {
  challenge: string;
  origin: string;
  expires: number;
}

@Injectable()
export class PasskeysService {
  private readonly allowedOrigins: string[];
  // Short-lived and single-use; a restart only means retrying the prompt.
  private readonly registrationChallenges = new Map<string, PendingChallenge>();
  private readonly loginChallenges = new Map<string, PendingChallenge>();

  constructor(
    @InjectRepository(Passkey) private readonly passkeysRepo: Repository<Passkey>,
    private readonly usersService: UsersService,
    config: ConfigService,
  ) {
    const fromEnv = config.get<string>('WEBAUTHN_ORIGINS');
    this.allowedOrigins = fromEnv ? fromEnv.split(',').map((o) => o.trim()).filter(Boolean) : DEFAULT_ORIGINS;
  }

  private rp(origin: string | undefined) {
    if (!origin || !this.allowedOrigins.includes(origin)) {
      throw new BadRequestException('Passkeys are not available on this site');
    }
    return { origin, rpID: new URL(origin).hostname };
  }

  private take(map: Map<string, PendingChallenge>, key: string): PendingChallenge {
    const pending = map.get(key);
    map.delete(key);
    if (!pending || pending.expires < Date.now()) {
      throw new BadRequestException('That took too long — please try again');
    }
    return pending;
  }

  private sweep(map: Map<string, PendingChallenge>) {
    const now = Date.now();
    for (const [k, v] of map) if (v.expires < now) map.delete(k);
  }

  async registrationOptions(userId: string, originHeader: string | undefined) {
    const { origin, rpID } = this.rp(originHeader);
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    const existing = await this.passkeysRepo.find({ where: { userId } });
    const options = await generateRegistrationOptions({
      rpName: 'Arogya',
      rpID,
      userName: user.phone ?? user.email ?? user.id,
      userDisplayName: user.fullName,
      userID: new TextEncoder().encode(user.id),
      attestationType: 'none',
      excludeCredentials: existing.map((p) => ({
        id: p.id,
        transports: (p.transports ?? undefined) as AuthenticatorTransport[] | undefined,
      })),
      // Discoverable, so login needs no phone number — just the fingerprint.
      authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
    });
    this.sweep(this.registrationChallenges);
    this.registrationChallenges.set(userId, {
      challenge: options.challenge,
      origin,
      expires: Date.now() + CHALLENGE_TTL_MS,
    });
    return options;
  }

  async register(userId: string, response: RegistrationResponseJSON, deviceName: string | undefined) {
    const pending = this.take(this.registrationChallenges, userId);
    const { verified, registrationInfo } = await verifyRegistrationResponse({
      response,
      expectedChallenge: pending.challenge,
      expectedOrigin: pending.origin,
      expectedRPID: new URL(pending.origin).hostname,
    }).catch((err: Error) => {
      throw new BadRequestException(`Passkey could not be verified: ${err.message}`);
    });
    if (!verified || !registrationInfo) throw new BadRequestException('Passkey could not be verified');

    const { credential } = registrationInfo;
    await this.passkeysRepo.save(
      this.passkeysRepo.create({
        id: credential.id,
        userId,
        publicKey: Buffer.from(credential.publicKey),
        counter: String(credential.counter),
        transports: credential.transports ?? null,
        deviceName: deviceName?.trim().slice(0, 80) || 'This device',
      }),
    );
    return this.list(userId);
  }

  async loginOptions(originHeader: string | undefined) {
    const { origin, rpID } = this.rp(originHeader);
    const options = await generateAuthenticationOptions({ rpID, userVerification: 'preferred' });
    const challengeId = randomBytes(16).toString('base64url');
    this.sweep(this.loginChallenges);
    this.loginChallenges.set(challengeId, { challenge: options.challenge, origin, expires: Date.now() + CHALLENGE_TTL_MS });
    return { challengeId, options };
  }

  // Returns the user id the passkey belongs to once the signature checks
  // out; the caller issues the session.
  async authenticate(challengeId: string, response: AuthenticationResponseJSON): Promise<string> {
    const pending = this.take(this.loginChallenges, challengeId);
    const passkey = await this.passkeysRepo.findOne({ where: { id: response.id } });
    if (!passkey) throw new UnauthorizedException('This passkey is not registered with Arogya any more');

    const { verified, authenticationInfo } = await verifyAuthenticationResponse({
      response,
      expectedChallenge: pending.challenge,
      expectedOrigin: pending.origin,
      expectedRPID: new URL(pending.origin).hostname,
      credential: {
        id: passkey.id,
        publicKey: new Uint8Array(passkey.publicKey),
        counter: Number(passkey.counter),
        transports: (passkey.transports ?? undefined) as AuthenticatorTransport[] | undefined,
      },
    }).catch(() => {
      throw new UnauthorizedException('Passkey sign-in failed');
    });
    if (!verified) throw new UnauthorizedException('Passkey sign-in failed');

    await this.passkeysRepo.update(passkey.id, {
      counter: String(authenticationInfo.newCounter),
      lastUsedAt: new Date(),
    });
    return passkey.userId;
  }

  async list(userId: string) {
    const rows = await this.passkeysRepo.find({ where: { userId }, order: { createdAt: 'DESC' } });
    return rows.map((p) => ({ id: p.id, deviceName: p.deviceName, createdAt: p.createdAt, lastUsedAt: p.lastUsedAt }));
  }

  async remove(userId: string, id: string) {
    const result = await this.passkeysRepo.delete({ id, userId });
    if (!result.affected) throw new NotFoundException('Passkey not found');
    return this.list(userId);
  }
}
