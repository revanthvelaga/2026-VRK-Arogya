import { Injectable, PreconditionFailedException, UnauthorizedException } from '@nestjs/common';
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
  async googleLogin(idToken: string, referralCode?: string) {
    const { email, name } = await this.googleAuthService.verify(idToken);

    let user = await this.usersService.findByEmail(email);
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
  async phoneOtpLogin(idToken: string, fullName?: string, referralCode?: string) {
    const { phone } = await this.firebasePhoneAuthService.verify(idToken);

    let user = await this.usersService.findByPhone(phone);
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

  private issueTokens(userId: string, phone: string | undefined, role: Role) {
    const payload = { sub: userId, phone, role };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.get('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get('JWT_ACCESS_EXPIRES_IN'),
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.config.get('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN'),
    });

    return { accessToken, refreshToken, role };
  }
}
