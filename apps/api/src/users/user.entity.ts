import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Role } from '../common/enums/role.enum';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'full_name', length: 150 })
  fullName: string;

  // Nullable — a Google sign-up has no phone until the customer adds one
  // later, and Postgres treats every NULL as distinct for a unique index,
  // so multiple phone-less accounts don't collide with each other.
  @Column({ unique: true, length: 15, nullable: true })
  phone?: string;

  @Column({ unique: true, length: 150, nullable: true })
  email?: string;

  // Nullable for the same reason: an account created via Google or phone
  // OTP never sets a password, so there's nothing to hash. Password
  // login for such an account correctly fails validatePassword() rather
  // than crashing on a missing hash.
  @Column({ name: 'password_hash', nullable: true })
  passwordHash?: string;

  @Column({ type: 'enum', enum: Role, default: Role.CUSTOMER })
  role: Role;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
