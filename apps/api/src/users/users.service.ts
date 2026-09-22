import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './user.entity';
import { Role } from '../common/enums/role.enum';

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
}
