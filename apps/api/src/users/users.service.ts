import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './user.entity';
import { Role } from '../common/enums/role.enum';

// Never the password hash — this is what a staff roster listing or a
// just-created account is allowed to hand back over HTTP.
export interface StaffSummary {
  id: string;
  fullName: string;
  phone?: string;
  email?: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
}

function toStaffSummary(user: User): StaffSummary {
  return {
    id: user.id,
    fullName: user.fullName,
    phone: user.phone,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  findByPhone(phone: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { phone } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { id } });
  }

  async create(params: {
    fullName: string;
    phone: string;
    email?: string;
    password: string;
    role?: Role;
  }): Promise<User> {
    const existing = await this.findByPhone(params.phone);
    if (existing) {
      throw new ConflictException('Phone number already registered');
    }

    const passwordHash = await bcrypt.hash(params.password, 10);

    const user = this.usersRepo.create({
      fullName: params.fullName,
      phone: params.phone,
      email: params.email,
      passwordHash,
      role: params.role ?? Role.CUSTOMER,
    });

    return this.usersRepo.save(user);
  }

  // Google and phone-OTP sign-ins never set a password — there's nothing
  // to hash, so this skips straight past bcrypt rather than hashing an
  // empty string (which would otherwise let literally nothing be typed
  // in as a "password" and pass validatePassword).
  async createOAuthUser(params: {
    fullName: string;
    phone?: string;
    email?: string;
    role?: Role;
  }): Promise<User> {
    const user = this.usersRepo.create({
      fullName: params.fullName,
      phone: params.phone,
      email: params.email,
      role: params.role ?? Role.CUSTOMER,
    });
    return this.usersRepo.save(user);
  }

  async validatePassword(user: User, password: string): Promise<boolean> {
    if (!user.passwordHash) return false;
    return bcrypt.compare(password, user.passwordHash);
  }

  // The field agents (and back-office admins) a booking can be assigned
  // to. Anyone who can log in as staff/admin is a valid assignment target —
  // there's no separate "agent" role, STAFF already means exactly this.
  async listStaff(): Promise<StaffSummary[]> {
    const users = await this.usersRepo.find({
      where: { role: In([Role.STAFF, Role.ADMIN]) },
      order: { fullName: 'ASC' },
    });
    return users.map(toStaffSummary);
  }

  // Admin-only account creation for a field agent — the public /auth/register
  // route always forces Role.CUSTOMER, so this is the only way a STAFF
  // account comes into being.
  async createStaffAccount(params: { fullName: string; phone: string; password: string }): Promise<StaffSummary> {
    const user = await this.create({ ...params, role: Role.STAFF });
    return toStaffSummary(user);
  }
}
