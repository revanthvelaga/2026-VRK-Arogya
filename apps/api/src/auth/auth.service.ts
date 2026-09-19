import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { PatientsService } from '../patients/patients.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Role } from '../common/enums/role.enum';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly patientsService: PatientsService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    // Public self-registration is always CUSTOMER; ADMIN/STAFF accounts
    // should be created through a separate admin-only endpoint later.
    const user = await this.usersService.create({
      ...dto,
      role: Role.CUSTOMER,
    });
    // Every account gets a SELF patient profile immediately — bookings are
    // made for a patient, not the account directly, and this means there's
    // always at least one to pick without extra setup before a first booking.
    if (user.role === Role.CUSTOMER) {
      await this.patientsService.createSelf(user.id, user.fullName);
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

  private issueTokens(userId: string, phone: string, role: Role) {
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
