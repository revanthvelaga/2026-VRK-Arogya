import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
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
  specialization?: string;
  isActive: boolean;
  createdAt: Date;
}

export interface AgentCollectionRecord {
  sampleId: string;
  bookingId: string;
  scheduledAt: Date;
  collectedAt: Date;
  onTime: boolean | null;
  safetyIdVerified: boolean | null;
  safetyPpeUsed: boolean | null;
  safetyHygieneFollowed: boolean | null;
}

export interface AgentUpcomingBooking {
  bookingId: string;
  scheduledAt: Date;
  status: string;
  collectionMode: string;
  centerName?: string;
}

export interface AgentDetail {
  agent: StaffSummary;
  performance: {
    totalCollections: number;
    onTimeCount: number;
    onTimeRate: number; // 0-100, rounded
    safetyCompliantCount: number;
    safetyComplianceRate: number; // 0-100, rounded — all three checklist items true
    recent: AgentCollectionRecord[];
  };
  upcoming: AgentUpcomingBooking[];
}

function toStaffSummary(user: User): StaffSummary {
  return {
    id: user.id,
    fullName: user.fullName,
    phone: user.phone,
    email: user.email,
    role: user.role,
    specialization: user.specialization,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
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
    specialization?: string;
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
      specialization: params.specialization,
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
  async createStaffAccount(params: {
    fullName: string;
    phone: string;
    password: string;
    specialization?: string;
  }): Promise<StaffSummary> {
    const user = await this.create({ ...params, role: Role.STAFF });
    return toStaffSummary(user);
  }

  private async findStaffOrAdmin(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user || (user.role !== Role.STAFF && user.role !== Role.ADMIN)) {
      throw new NotFoundException('Agent not found');
    }
    return user;
  }

  // Editing an existing agent's profile — currently just name/specialization
  // and whether they're still active. Never touches phone or password here;
  // that's still whatever the agent (or an admin resetting it) sets at login.
  async updateStaffAccount(
    id: string,
    params: { fullName?: string; specialization?: string; isActive?: boolean },
  ): Promise<StaffSummary> {
    const user = await this.findStaffOrAdmin(id);
    if (params.fullName !== undefined) user.fullName = params.fullName;
    if (params.specialization !== undefined) user.specialization = params.specialization || undefined;
    if (params.isActive !== undefined) user.isActive = params.isActive;
    const saved = await this.usersRepo.save(user);
    return toStaffSummary(saved);
  }

  // One agent's full picture for the admin console: who they are, how
  // they've performed on every collection actually attributed to them
  // (booking.assigned_agent_id, not just whoever happened to tap "mark
  // collected" — see BookingsService.assignAgent), and what's still ahead
  // of them. Two bulk queries via raw SQL, same pattern as
  // BookingsService.attachLogistics, rather than pulling every sample/
  // booking row into memory to filter in JS.
  async getAgentDetail(id: string): Promise<AgentDetail> {
    const agent = await this.findStaffOrAdmin(id);

    const collectedRows = (await this.dataSource.query(
      `SELECT s.id AS sample_id, s.booking_id, b.scheduled_at, s.collected_at,
              s.on_time_collection, s.safety_id_verified, s.safety_ppe_used, s.safety_hygiene_followed
         FROM samples s
         JOIN bookings b ON b.id = s.booking_id
        WHERE b.assigned_agent_id = $1 AND s.collected_at IS NOT NULL
        ORDER BY s.collected_at DESC`,
      [id],
    )) as Array<{
      sample_id: string;
      booking_id: string;
      scheduled_at: Date;
      collected_at: Date;
      on_time_collection: boolean | null;
      safety_id_verified: boolean | null;
      safety_ppe_used: boolean | null;
      safety_hygiene_followed: boolean | null;
    }>;

    const total = collectedRows.length;
    const onTimeCount = collectedRows.filter((r) => r.on_time_collection === true).length;
    const safetyCompliantCount = collectedRows.filter(
      (r) => r.safety_id_verified && r.safety_ppe_used && r.safety_hygiene_followed,
    ).length;

    const upcomingRows = (await this.dataSource.query(
      `SELECT b.id AS booking_id, b.scheduled_at, b.status, b.collection_mode, c.name AS center_name
         FROM bookings b
         LEFT JOIN diagnostic_centers c ON c.id::text = b.center_id
        WHERE b.assigned_agent_id = $1 AND b.status IN ('PENDING', 'CONFIRMED')
        ORDER BY b.scheduled_at ASC
        LIMIT 20`,
      [id],
    )) as Array<{
      booking_id: string;
      scheduled_at: Date;
      status: string;
      collection_mode: string;
      center_name: string | null;
    }>;

    return {
      agent: toStaffSummary(agent),
      performance: {
        totalCollections: total,
        onTimeCount,
        onTimeRate: total ? Math.round((onTimeCount / total) * 100) : 0,
        safetyCompliantCount,
        safetyComplianceRate: total ? Math.round((safetyCompliantCount / total) * 100) : 0,
        recent: collectedRows.slice(0, 20).map((r) => ({
          sampleId: r.sample_id,
          bookingId: r.booking_id,
          scheduledAt: r.scheduled_at,
          collectedAt: r.collected_at,
          onTime: r.on_time_collection,
          safetyIdVerified: r.safety_id_verified,
          safetyPpeUsed: r.safety_ppe_used,
          safetyHygieneFollowed: r.safety_hygiene_followed,
        })),
      },
      upcoming: upcomingRows.map((r) => ({
        bookingId: r.booking_id,
        scheduledAt: r.scheduled_at,
        status: r.status,
        collectionMode: r.collection_mode,
        centerName: r.center_name ?? undefined,
      })),
    };
  }
}
