import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Patient } from './entities/patient.entity';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { Relationship } from '../common/enums/relationship.enum';
import { toGeoPoint } from '../common/utils/geo.util';
import { CareService } from './care.service';

export type PatientWithAccess = Patient & { sharedBy?: { accountId: string; name: string } };

@Injectable()
export class PatientsService {
  constructor(
    @InjectRepository(Patient)
    private readonly patientsRepo: Repository<Patient>,
    private readonly careService: CareService,
  ) {}

  // Called once at registration (see AuthService.register) — every account
  // gets exactly one SELF patient it can never delete, so there's always a
  // patient to attach a booking to without extra setup friction.
  createSelf(accountId: string, fullName: string): Promise<Patient> {
    const patient = this.patientsRepo.create({
      accountId,
      fullName,
      relationship: Relationship.SELF,
    });
    return this.patientsRepo.save(patient);
  }

  // The account's own family first, then the families it looks after as
  // a caregiver (tagged with whose they are).
  async findAllForAccount(accountId: string): Promise<PatientWithAccess[]> {
    const own = await this.patientsRepo.find({ where: { accountId, isActive: true }, order: { createdAt: 'ASC' } });
    const sharedIds = await this.careService.sharedPatientIds(accountId);
    if (!sharedIds.length) return own;
    const shared = await this.patientsRepo.find({
      where: { id: In(sharedIds), isActive: true },
      order: { createdAt: 'ASC' },
    });
    const ownerNames = await this.careService.ownerNames([...new Set(shared.map((p) => p.accountId))]);
    return [
      ...own,
      ...shared.map((p) => Object.assign(p, { sharedBy: { accountId: p.accountId, name: ownerNames.get(p.accountId) ?? 'Family' } })),
    ];
  }

  // Every patient this account may act for — its own and, through an
  // active family-access link, the people each family chose to share.
  async accessiblePatientIds(accountId: string): Promise<string[]> {
    const own = await this.patientsRepo.find({ where: { accountId }, select: ['id'] });
    return [...own.map((r) => r.id), ...(await this.careService.sharedPatientIds(accountId))];
  }

  async canAccessPatient(patientId: string, accountId: string): Promise<boolean> {
    const patient = await this.patientsRepo.findOne({ where: { id: patientId }, select: ['id', 'accountId'] });
    if (!patient) return false;
    return patient.accountId === accountId || this.careService.canCaregiverAccess(patientId, patient.accountId, accountId);
  }

  async findOne(id: string): Promise<Patient> {
    const patient = await this.patientsRepo.findOne({ where: { id } });
    if (!patient) throw new NotFoundException('Patient not found');
    return patient;
  }

  // The owner, or a caregiver with active family access.
  async findOneForAccount(id: string, accountId: string): Promise<Patient> {
    const patient = await this.findOne(id);
    if (patient.accountId !== accountId && !(await this.careService.canCaregiverAccess(id, patient.accountId, accountId))) {
      throw new ForbiddenException('Not your patient profile');
    }
    return patient;
  }

  create(accountId: string, dto: CreatePatientDto): Promise<Patient> {
    const { latitude, longitude, abhaNumber, abhaAddress, ...rest } = dto;
    const patient = this.patientsRepo.create({
      accountId,
      ...rest,
      abhaNumber: normalizeAbha(abhaNumber),
      abhaAddress: abhaAddress ? abhaAddress.toLowerCase() : null,
      location: latitude != null && longitude != null ? toGeoPoint(latitude, longitude) : undefined,
    });
    return this.patientsRepo.save(patient);
  }

  async update(id: string, accountId: string, dto: UpdatePatientDto): Promise<Patient> {
    const patient = await this.findOneForAccount(id, accountId);
    const { latitude, longitude, abhaNumber, abhaAddress, ...rest } = dto;
    Object.assign(patient, rest);
    if (abhaNumber !== undefined) patient.abhaNumber = normalizeAbha(abhaNumber);
    if (abhaAddress !== undefined) patient.abhaAddress = abhaAddress ? abhaAddress.toLowerCase() : null;
    if (latitude != null && longitude != null) {
      patient.location = toGeoPoint(latitude, longitude);
    }
    return this.patientsRepo.save(patient);
  }

  // Owner only — a caregiver can update a profile but not delete it.
  async remove(id: string, accountId: string): Promise<void> {
    const patient = await this.findOne(id);
    if (patient.accountId !== accountId) throw new ForbiddenException('Only the account owner can remove a profile');
    if (patient.relationship === Relationship.SELF) {
      throw new BadRequestException('Cannot remove your own patient profile');
    }
    patient.isActive = false;
    await this.patientsRepo.save(patient);
  }
}

// Stored in the familiar 2-4-4-4 form whichever way it was typed.
function normalizeAbha(v?: string | null): string | null {
  const d = (v ?? '').replace(/\D/g, '');
  return d.length === 14 ? `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6, 10)}-${d.slice(10)}` : null;
}
