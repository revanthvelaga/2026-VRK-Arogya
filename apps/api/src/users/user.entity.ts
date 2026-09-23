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

  // Only meaningful for STAFF (field agent) accounts — e.g. "Phlebotomy",
  // "Home collection", "Pediatric draw". Free text rather than an enum:
  // there's no fixed catalog of specialties an agent roster needs to pick
  // from, and admin should be able to type whatever the agent is actually
  // trained in.
  @Column({ length: 150, nullable: true })
  specialization?: string;

  // Common profile fields — every role (customer, staff, admin) can fill
  // these in on their own "My Profile" page. All nullable: existing rows
  // predate this, and nothing here is required to sign in or place/take a
  // booking; only ProfileService's completion-percentage calc treats an
  // empty one as "missing".
  @Column({ name: 'date_of_birth', type: 'date', nullable: true })
  dateOfBirth?: string;

  @Column({ length: 20, nullable: true })
  gender?: string;

  @Column({ name: 'address_line', type: 'text', nullable: true })
  addressLine?: string;

  @Column({ length: 100, nullable: true })
  city?: string;

  @Column({ length: 100, nullable: true })
  state?: string;

  @Column({ length: 10, nullable: true })
  pincode?: string;

  // Agent-only (STAFF) — the academic side of their profile. A customer
  // or admin profile never sets these; ProfileService's completion calc
  // only counts them against a STAFF account.
  @Column({ length: 150, nullable: true })
  qualification?: string;

  @Column({ length: 150, nullable: true })
  institution?: string;

  @Column({ name: 'graduation_year', type: 'int', nullable: true })
  graduationYear?: number;

  // Admin-set, never self-reported — an agent's own profile update can
  // never touch this column (see UsersService.updateProfile, which only
  // ever writes the fields UpdateProfileDto exposes). Only
  // UsersService.updateStaffAccount, the admin-only staff-edit path, can
  // set it.
  @Column({ name: 'monthly_salary', type: 'numeric', precision: 10, scale: 2, nullable: true })
  monthlySalary?: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
