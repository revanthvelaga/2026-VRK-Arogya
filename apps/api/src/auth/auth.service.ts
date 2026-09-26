import { ForbiddenException, Injectable, NotFoundException, PreconditionFailedException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { PatientsService } from '../patients/patients.service';
import { GoogleAuthService } from './google-auth.service';
import { FirebasePhoneAuthService } from './firebase-phone-auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Role } from '../common/enums/role.enum';
import { WalletService } from '../rewards/wallet.service';
import type { User } from '../users/user.entity';

// Every sign-in must be repeated at least this often.
const MAX_SESSION_SECONDS = 7 * 24 * 60 * 60;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly patientsService: PatientsService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly googleAuthService: GoogleAuthService,
    private readonly firebasePhoneAuthService: FirebasePhoneAuthService,
    private readonly walletService: WalletService,
  ) {}

  async register(dto: RegisterDto) {
    // Public self-registration is always CUSTOMER; ADMIN/STAFF accounts
    // should be created through a separate admin-only endpoint later.
    const { referralCode, ...fields } = dto;
    const user = await this.usersService.create({
      ...fields,
      role: Role.CUSTOMER,
    });
    // Every account gets a SELF patient profile immediately — bookings are
    // made for a patient, not the account directly, and this means there's
    // always at least one to pick without extra setup before a first booking.
    if (user.role === Role.CUSTOMER) {
      await this.patientsService.createSelf(user.id, user.fullName);
    }
    // A bad referral code shouldn't block creating the account — the
    // customer can still add a valid one from their wallet afterwards.
    if (referralCode?.trim()) {
      await this.walletService.applyReferral(user.id, referralCode).catch(() => undefined);
    }
    return this.issueTokens(user.id, user.phone, user.role);
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByPhone(dto.phone);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await this.usersService.validatePassword(user, dto.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return this.issueTokens(user.id, user.phone, user.role);
  }

  // "Sign in with Google" — same account either way: an existing email
  // logs straight in, a new one is created and given the usual SELF
  // patient profile, same as register().
  async googleLogin(idToken: string, referralCode?: string, portal?: 'ADMIN' | 'STAFF') {
    const { email, name } = await this.googleAuthService.verify(idToken);

    let user = await this.usersService.findByEmail(email);
    if (portal) {
      this.assertStaffPortal(user, portal, 'This Google account isn’t linked to a staff account. Ask your admin to add this email to your profile.');
      return this.issueTokens(user!.id, user!.phone, user!.role);
    }
    if (!user) {
      user = await this.usersService.createOAuthUser({
        fullName: name?.trim() || email.split('@')[0],
        email,
        role: Role.CUSTOMER,
      });
      await this.patientsService.createSelf(user.id, user.fullName);
      if (referralCode?.trim()) {
        await this.walletService.applyReferral(user.id, referralCode).catch(() => undefined);
      }
    }

    return this.issueTokens(user.id, user.phone, user.role);
  }

  // Mobile OTP — the frontend verifies the code with Firebase directly
  // and only reaches us with the resulting (already-verified) token, so
  // there's no OTP to check here, only whose phone it belongs to.
  async phoneOtpLogin(idToken: string, fullName?: string, referralCode?: string, portal?: 'ADMIN' | 'STAFF') {
    const { phone } = await this.firebasePhoneAuthService.verify(idToken);

    let user = await this.usersService.findByPhone(phone);
    if (portal) {
      this.assertStaffPortal(user, portal, 'This mobile number isn’t linked to a staff account.');
      return this.issueTokens(user!.id, user!.phone, user!.role);
    }
    if (!user) {
      if (!fullName?.trim()) {
        throw new PreconditionFailedException('New account — enter your name to finish signing up.');
      }
      user = await this.usersService.createOAuthUser({ fullName: fullName.trim(), phone, role: Role.CUSTOMER });
      await this.patientsService.createSelf(user.id, user.fullName);
      if (referralCode?.trim()) {
        await this.walletService.applyReferral(user.id, referralCode).catch(() => undefined);
      }
    }

    return this.issueTokens(user.id, user.phone, user.role);
  }

  // Staff console sign-ins: the account must already exist with the
  // portal's role — OTP and Google never create staff accounts.
  private assertStaffPortal(user: User | null, portal: 'ADMIN' | 'STAFF', notStaffMessage: string) {
    if (!user || (user.role !== Role.ADMIN && user.role !== Role.STAFF)) {
      throw new ForbiddenException(notStaffMessage);
    }
    if (user.role !== portal) {
      throw new ForbiddenException(
        portal === Role.ADMIN
          ? 'This is an agent account — use the Agent Login tab instead.'
          : 'This is an admin account — use the Admin Login tab instead.',
      );
    }
  }

  // "Forgot password" — Firebase has already verified the phone (the same
  // proof the OTP sign-in endpoint trusts), so no separate reset-code
  // system is needed; this just confirms an account exists for that
  // number and overwrites its password, then logs the customer straight in.
  async resetPasswordWithPhone(idToken: string, newPassword: string) {
    const { phone } = await this.firebasePhoneAuthService.verify(idToken);

    const user = await this.usersService.findByPhone(phone);
    if (!user) {
      throw new NotFoundException('No account found for this phone number.');
    }

    await this.usersService.setPassword(user.id, newPassword);
    return this.issueTokens(user.id, user.phone, user.role);
  }

  // Swaps a still-valid refresh token for a fresh pair, so an active user
  // isn't cut off by the short access-token lifetime. The session start
  // (`sst`) rides along unchanged, capping every session at
  // MAX_SESSION_SECONDS from the original sign-in however active it is.
  async refresh(refreshToken: string) {
    let payload: { sub: string; sst?: number };
    try {
      payload = this.jwtService.verify(refreshToken, { secret: this.config.get('JWT_REFRESH_SECRET') });
    } catch {
      throw new UnauthorizedException('Session expired — please sign in again.');
    }
    const sessionStart = payload.sst ?? Math.floor(Date.now() / 1000);
    if (Date.now() / 1000 - sessionStart > MAX_SESSION_SECONDS) {
      throw new UnauthorizedException('Session expired — please sign in again.');
    }
    const user = await this.usersService.findById(payload.sub);
    if (!user || user.isActive === false) {
      throw new UnauthorizedException('Session expired — please sign in again.');
    }
    return this.issueTokens(user.id, user.phone, user.role, sessionStart);
  }

  private issueTokens(userId: string, phone: string | undefined, role: Role, sessionStart?: number) {
    const sst = sessionStart ?? Math.floor(Date.now() / 1000);
    const payload = { sub: userId, phone, role, sst };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.get('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get('JWT_ACCESS_EXPIRES_IN') ?? '15m',
    });

    // Never outlives the session cap, even right after a refresh.
    const remaining = Math.max(60, MAX_SESSION_SECONDS - (Math.floor(Date.now() / 1000) - sst));
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.config.get('JWT_REFRESH_SECRET'),
      expiresIn: remaining,
    });

    return { accessToken, refreshToken, role };
  }
}
