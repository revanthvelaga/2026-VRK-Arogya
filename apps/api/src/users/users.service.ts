import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './user.entity';
import { AgentCertificate } from './entities/agent-certificate.entity';
import { AgentLeave } from './entities/agent-leave.entity';
import { Role } from '../common/enums/role.enum';
import { LeaveStatus } from '../common/enums/leave-status.enum';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { RequestLeaveDto } from './dto/request-leave.dto';

// Never the password hash — this is what a staff roster listing or a
// just-created account is allowed to hand back over HTTP. monthlySalary
// rides along here too — fine, since every caller of listStaff()/
// createStaffAccount() is already ADMIN-only (see UsersController).
export interface StaffSummary {
  id: string;
  fullName: string;
  phone?: string;
  email?: string;
  role: Role;
  specialization?: string;
  monthlySalary?: number;
  isActive: boolean;
  createdAt: Date;
}

// The common fields every role can edit on their own profile — dob,
// gender, address — plus the agent-only academic fields, which only ever
// count toward a STAFF account's completion percentage.
const COMMON_PROFILE_FIELDS = ['fullName', 'phone', 'email', 'dateOfBirth', 'gender', 'addressLine', 'city', 'state', 'pincode'] as const;
const AGENT_PROFILE_FIELDS = ['qualification', 'institution', 'graduationYear'] as const;

export interface CertificateSummary {
  id: string;
  title: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
}

export interface ProfileResponse {
  id: string;
  fullName: string;
  phone?: string;
  email?: string;
  role: Role;
  specialization?: string;
  dateOfBirth?: string;
  gender?: string;
  addressLine?: string;
  city?: string;
  state?: string;
  pincode?: string;
  qualification?: string;
  institution?: string;
  graduationYear?: number;
  isActive: boolean;
  createdAt: Date;
  // Only meaningful (and only computed) for STAFF — a customer/admin
  // profile is never "incomplete" in a way that blocks anything.
  completionPercent: number;
  missingFields: string[];
  certificateCount: number;
}

export interface LeaveRecord {
  id: string;
  startDate: string;
  endDate: string;
  leaveType: string;
  reason?: string;
  status: LeaveStatus;
  createdAt: Date;
}

// Same shape, plus who it belongs to — for the admin-wide leave/calendar
// view, where every row needs to say which agent it's about.
export interface AgentLeaveRecord extends LeaveRecord {
  agentId: string;
  agentName: string;
  agentPhone?: string;
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
  profile: ProfileResponse;
  monthlySalary?: number;
  certificates: CertificateSummary[];
  leaves: LeaveRecord[];
  performance: {
    totalCollections: number;
    onTimeCount: number;
    onTimeRate: number; // 0-100, rounded
    safetyCompliantCount: number;
    safetyComplianceRate: number; // 0-100, rounded — all three checklist items true
    recent: AgentCollectionRecord[];
    ratingAverage: number | null; // 1-5, one decimal; null until rated
    ratingCount: number;
    recentRatings: Array<{ bookingId: string; rating: number; comment?: string; createdAt: Date }>;
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
    monthlySalary: user.monthlySalary,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

function toCertificateSummary(cert: AgentCertificate): CertificateSummary {
  return {
    id: cert.id,
    title: cert.title,
    fileName: cert.fileName,
    mimeType: cert.mimeType,
    sizeBytes: cert.sizeBytes,
    createdAt: cert.createdAt,
  };
}

function toLeaveRecord(leave: AgentLeave): LeaveRecord {
  return {
    id: leave.id,
    startDate: leave.startDate,
    endDate: leave.endDate,
    leaveType: leave.leaveType,
    reason: leave.reason,
    status: leave.status,
    createdAt: leave.createdAt,
  };
}

// Every common field, plus the academic ones for a STAFF account, plus
// (for STAFF) "has at least one certificate uploaded" as its own check.
// Missing = falsy/empty — an empty string counts as not filled in, not
// just null/undefined, since that's what a cleared form field leaves.
function computeCompletion(user: User, certificateCount: number): { percent: number; missing: string[] } {
  const fields: readonly string[] =
    user.role === Role.STAFF ? [...COMMON_PROFILE_FIELDS, ...AGENT_PROFILE_FIELDS] : COMMON_PROFILE_FIELDS;
  const missing: string[] = [];
  let filled = 0;
  for (const field of fields) {
    const value = (user as unknown as Record<string, unknown>)[field];
    if (value !== null && value !== undefined && value !== '') filled += 1;
    else missing.push(field);
  }
  let totalChecks = fields.length;
  if (user.role === Role.STAFF) {
    totalChecks += 1;
    if (certificateCount > 0) filled += 1;
    else missing.push('certificate');
  }
  const percent = totalChecks ? Math.round((filled / totalChecks) * 100) : 100;
  return { percent, missing };
}

function toProfileResponse(user: User, certificateCount: number): ProfileResponse {
  const { percent, missing } = computeCompletion(user, certificateCount);
  return {
    id: user.id,
    fullName: user.fullName,
    phone: user.phone,
    email: user.email,
    role: user.role,
    specialization: user.specialization,
    dateOfBirth: user.dateOfBirth,
    gender: user.gender,
    addressLine: user.addressLine,
    city: user.city,
    state: user.state,
    pincode: user.pincode,
    qualification: user.qualification,
    institution: user.institution,
    graduationYear: user.graduationYear,
    isActive: user.isActive,
    createdAt: user.createdAt,
    completionPercent: percent,
    missingFields: missing,
    certificateCount,
  };
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(AgentCertificate)
    private readonly certificatesRepo: Repository<AgentCertificate>,
    @InjectRepository(AgentLeave)
    private readonly leavesRepo: Repository<AgentLeave>,
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

  // Used by the "forgot password" flow (after Firebase has verified the
  // phone via OTP) and by a customer setting a first password from their
  // profile — either way the caller has already confirmed who this is.
  async setPassword(userId: string, newPassword: string): Promise<void> {
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.usersRepo.update({ id: userId }, { passwordHash });
  }

  // ---------------------------------------------------------------------
  // Self-service profile — any authenticated role, their own account only.
  // ---------------------------------------------------------------------

  async getProfile(userId: string): Promise<ProfileResponse> {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('Account not found');
    const certificateCount = await this.certificatesRepo.count({ where: { userId } });
    return toProfileResponse(user, certificateCount);
  }

  // Deliberately narrow: only the fields UpdateProfileDto exposes ever get
  // written here — salary, role, isActive, phone and password all stay
  // untouched no matter what a client sends, since none of those belong
  // to "editing your own profile".
  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<ProfileResponse> {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('Account not found');
    if (dto.email !== undefined && dto.email !== user.email) {
      const existing = await this.findByEmail(dto.email);
      if (existing && existing.id !== userId) {
        throw new ConflictException('Email address already in use');
      }
      user.email = dto.email;
    }
    if (dto.fullName !== undefined) user.fullName = dto.fullName;
    if (dto.dateOfBirth !== undefined) user.dateOfBirth = dto.dateOfBirth;
    if (dto.gender !== undefined) user.gender = dto.gender;
    if (dto.addressLine !== undefined) user.addressLine = dto.addressLine;
    if (dto.city !== undefined) user.city = dto.city;
    if (dto.state !== undefined) user.state = dto.state;
    if (dto.pincode !== undefined) user.pincode = dto.pincode;
    // Academic fields are real columns on every role's row, but only a
    // STAFF account's completion percentage ever looks at them — a
    // customer setting them is harmless, just never counted.
    if (dto.qualification !== undefined) user.qualification = dto.qualification;
    if (dto.institution !== undefined) user.institution = dto.institution;
    if (dto.graduationYear !== undefined) user.graduationYear = dto.graduationYear;
    const saved = await this.usersRepo.save(user);
    const certificateCount = await this.certificatesRepo.count({ where: { userId } });
    return toProfileResponse(saved, certificateCount);
  }

  // Certificates are an agent (STAFF) concept — checked here, not just by
  // hiding the button client-side, since this is the actual write path.
  async uploadCertificate(
    userId: string,
    role: string,
    title: string,
    file: Express.Multer.File,
  ): Promise<CertificateSummary> {
    if (role !== Role.STAFF) {
      throw new ForbiddenException('Only agent accounts upload certificates');
    }
    const cert = await this.certificatesRepo.save(
      this.certificatesRepo.create({
        userId,
        title,
        fileData: file.buffer,
        fileName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      }),
    );
    return toCertificateSummary(cert);
  }

  async listCertificates(userId: string): Promise<CertificateSummary[]> {
    const certs = await this.certificatesRepo.find({ where: { userId }, order: { createdAt: 'DESC' } });
    return certs.map(toCertificateSummary);
  }

  // The certificate's own owner, or an ADMIN doing oversight — never
  // another agent, never a customer.
  async getCertificateForDownload(id: string, user: AuthenticatedUser): Promise<AgentCertificate> {
    const cert = await this.certificatesRepo.findOne({ where: { id } });
    if (!cert) throw new NotFoundException('Certificate not found');
    if (cert.userId !== user.userId && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Not authorized to view this certificate');
    }
    return cert;
  }

  // ---------------------------------------------------------------------
  // Leave requests — an agent raises one from their own portal; an admin
  // approves/rejects from the staff roster.
  // ---------------------------------------------------------------------

  async requestLeave(userId: string, role: string, dto: RequestLeaveDto): Promise<LeaveRecord> {
    if (role !== Role.STAFF) {
      throw new ForbiddenException('Only agent accounts request leave');
    }
    if (new Date(dto.endDate) < new Date(dto.startDate)) {
      throw new BadRequestException('endDate cannot be before startDate');
    }
    const leave = await this.leavesRepo.save(
      this.leavesRepo.create({
        userId,
        startDate: dto.startDate,
        endDate: dto.endDate,
        leaveType: dto.leaveType,
        reason: dto.reason,
        status: LeaveStatus.PENDING,
      }),
    );
    return toLeaveRecord(leave);
  }

  async listOwnLeaves(userId: string): Promise<LeaveRecord[]> {
    const leaves = await this.leavesRepo.find({ where: { userId }, order: { startDate: 'DESC' } });
    return leaves.map(toLeaveRecord);
  }

  async reviewLeave(leaveId: string, reviewerId: string, status: LeaveStatus.APPROVED | LeaveStatus.REJECTED): Promise<LeaveRecord> {
    const leave = await this.leavesRepo.findOne({ where: { id: leaveId } });
    if (!leave) throw new NotFoundException('Leave request not found');
    leave.status = status;
    leave.reviewedBy = reviewerId;
    const saved = await this.leavesRepo.save(leave);
    return toLeaveRecord(saved);
  }

  // Every leave request across every agent — admin-only, for the
  // roster-wide leave/calendar page (as opposed to listOwnLeaves, one
  // agent's own history, or getAgentDetail's leaves, one agent's from the
  // admin side).
  async listAllLeaves(): Promise<AgentLeaveRecord[]> {
    const leaves = await this.leavesRepo.find({ relations: ['user'], order: { startDate: 'DESC' } });
    return leaves.map((l) => ({
      ...toLeaveRecord(l),
      agentId: l.userId,
      agentName: l.user?.fullName ?? 'Unknown',
      agentPhone: l.user?.phone,
    }));
  }

  // ---------------------------------------------------------------------
  // Admin-only staff roster management.
  // ---------------------------------------------------------------------

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

  async resetStaffPassword(id: string, newPassword: string): Promise<{ ok: true }> {
    const user = await this.findStaffOrAdmin(id);
    await this.setPassword(user.id, newPassword);
    return { ok: true };
  }

  // Editing an existing agent's profile from the admin side — name,
  // specialization, active status, and salary (never self-reported by the
  // agent — see updateProfile above, which never touches monthlySalary).
  async updateStaffAccount(
    id: string,
    params: { fullName?: string; specialization?: string; isActive?: boolean; monthlySalary?: number },
  ): Promise<StaffSummary> {
    const user = await this.findStaffOrAdmin(id);
    if (params.fullName !== undefined) user.fullName = params.fullName;
    if (params.specialization !== undefined) user.specialization = params.specialization || undefined;
    if (params.isActive !== undefined) user.isActive = params.isActive;
    if (params.monthlySalary !== undefined) user.monthlySalary = params.monthlySalary;
    const saved = await this.usersRepo.save(user);
    return toStaffSummary(saved);
  }

  // One agent's full picture for the admin console: who they are (profile,
  // address, academic details, certificates, salary), how they've
  // performed on every collection actually attributed to them
  // (booking.assigned_agent_id, not just whoever happened to tap "mark
  // collected" — see BookingsService.assignAgent), their leave record, and
  // what's still ahead of them. Two bulk queries via raw SQL, same pattern
  // as BookingsService.attachLogistics, rather than pulling every sample/
  // booking row into memory to filter in JS.
  async getAgentDetail(id: string): Promise<AgentDetail> {
    const agent = await this.findStaffOrAdmin(id);
    const certificateCount = await this.certificatesRepo.count({ where: { userId: id } });
    const certificates = await this.certificatesRepo.find({ where: { userId: id }, order: { createdAt: 'DESC' } });
    const leaves = await this.leavesRepo.find({ where: { userId: id }, order: { startDate: 'DESC' } });

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

    const ratingRows = (await this.dataSource.query(
      `SELECT booking_id, rating, comment, created_at FROM agent_ratings WHERE agent_id = $1 ORDER BY created_at DESC`,
      [id],
    )) as Array<{ booking_id: string; rating: number; comment: string | null; created_at: Date }>;
    const ratingAverage = ratingRows.length
      ? Math.round((ratingRows.reduce((sum, r) => sum + Number(r.rating), 0) / ratingRows.length) * 10) / 10
      : null;

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
      profile: toProfileResponse(agent, certificateCount),
      monthlySalary: agent.monthlySalary,
      certificates: certificates.map(toCertificateSummary),
      leaves: leaves.map(toLeaveRecord),
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
        ratingAverage,
        ratingCount: ratingRows.length,
        recentRatings: ratingRows.slice(0, 10).map((r) => ({
          bookingId: r.booking_id,
          rating: Number(r.rating),
          comment: r.comment ?? undefined,
          createdAt: r.created_at,
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
