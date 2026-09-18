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

  async validatePassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.passwordHash);
  }
}
