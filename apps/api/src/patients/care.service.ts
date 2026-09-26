import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CareLink } from './entities/care-link.entity';

interface PatientRow {
  id: string;
  full_name: string;
  relationship: string;
}

interface UserRow {
  id: string;
  full_name: string;
  phone: string | null;
}

@Injectable()
export class CareService {
  constructor(
    @InjectRepository(CareLink) private readonly linksRepo: Repository<CareLink>,
    private readonly dataSource: DataSource,
  ) {}

  private async users(ids: string[]): Promise<Map<string, UserRow>> {
    if (!ids.length) return new Map();
    const rows = (await this.dataSource.query(
      `SELECT id, full_name, phone FROM users WHERE id = ANY($1::uuid[])`,
      [ids],
    )) as UserRow[];
    return new Map(rows.map((r) => [r.id, r]));
  }

  async nameOf(userId: string): Promise<string> {
    return (await this.users([userId])).get(userId)?.full_name ?? 'A family member';
  }

  async ownerNames(ownerIds: string[]): Promise<Map<string, string>> {
    const rows = await this.users(ownerIds);
    return new Map([...rows].map(([id, r]) => [id, r.full_name]));
  }

  private async activePatientsOf(ownerId: string): Promise<PatientRow[]> {
    return (await this.dataSource.query(
      `SELECT id, full_name, relationship FROM patients WHERE account_id = $1 AND is_active = true ORDER BY created_at`,
      [ownerId],
    )) as PatientRow[];
  }

  // Only the owner's own, active patients can be shared.
  private async validPatientIds(ownerId: string, patientIds: string[]): Promise<string[]> {
    const own = new Set((await this.activePatientsOf(ownerId)).map((p) => p.id));
    const ids = [...new Set(patientIds)];
    if (!ids.length) throw new BadRequestException('Choose at least one person to share');
    if (ids.some((id) => !own.has(id))) throw new BadRequestException('You can only share your own family members');
    return ids;
  }

  async list(userId: string) {
    const links = await this.linksRepo.find({
      where: [{ ownerId: userId }, { caregiverId: userId }],
      order: { createdAt: 'DESC' },
    });
    const people = await this.users([...new Set(links.flatMap((l) => [l.ownerId, l.caregiverId]))]);
    const person = (id: string) => ({
      id,
      fullName: people.get(id)?.full_name ?? 'Unknown',
      phone: people.get(id)?.phone ?? undefined,
    });
    // Names of the people each link shares, for both sides to see.
    const ownerIds = [...new Set(links.map((l) => l.ownerId))];
    const patientsByOwner = new Map(await Promise.all(ownerIds.map(async (o) => [o, await this.activePatientsOf(o)] as const)));
    const shared = (l: CareLink) =>
      (patientsByOwner.get(l.ownerId) ?? [])
        .filter((p) => !l.patientIds || l.patientIds.includes(p.id))
        .map((p) => ({ id: p.id, fullName: p.full_name, relationship: p.relationship }));
    const view = (l: CareLink, other: string) => ({
      id: l.id,
      status: l.status,
      createdAt: l.createdAt,
      person: person(other),
      sharesAll: l.patientIds === null,
      patients: shared(l),
    });
    return {
      // People who can see (some of) my family's health.
      caregivers: links.filter((l) => l.ownerId === userId).map((l) => view(l, l.caregiverId)),
      // Families I look after (or have been invited to).
      caringFor: links.filter((l) => l.caregiverId === userId).map((l) => view(l, l.ownerId)),
    };
  }

  async invite(ownerId: string, rawPhone: string, patientIds: string[]) {
    const ids = await this.validPatientIds(ownerId, patientIds);
    const phone = rawPhone.replace(/\D/g, '').slice(-10);
    const [caregiver] = (await this.dataSource.query(
      `SELECT id, full_name, phone FROM users WHERE phone = $1 AND role = 'CUSTOMER'`,
      [phone],
    )) as UserRow[];
    if (!caregiver) {
      throw new NotFoundException('No Arogya account with that number — ask them to sign up first, then invite again');
    }
    if (caregiver.id === ownerId) throw new BadRequestException("You can't add yourself");
    const existing = await this.linksRepo.findOne({ where: { ownerId, caregiverId: caregiver.id } });
    if (existing) throw new ConflictException(`${caregiver.full_name} is already ${existing.status === 'ACTIVE' ? 'added' : 'invited'}`);
    const link = await this.linksRepo.save(this.linksRepo.create({ ownerId, caregiverId: caregiver.id, patientIds: ids }));
    return { link, caregiverName: caregiver.full_name, caregiverId: caregiver.id };
  }

  async accept(id: string, userId: string) {
    const link = await this.linksRepo.findOne({ where: { id } });
    if (!link || link.caregiverId !== userId) throw new NotFoundException('Invitation not found');
    link.status = 'ACTIVE';
    link.acceptedAt = new Date();
    return this.linksRepo.save(link);
  }

  // Owner only: change which people this caregiver can see.
  async updatePatients(id: string, ownerId: string, patientIds: string[]) {
    const link = await this.linksRepo.findOne({ where: { id } });
    if (!link || link.ownerId !== ownerId) throw new NotFoundException('Not found');
    link.patientIds = await this.validPatientIds(ownerId, patientIds);
    return this.linksRepo.save(link);
  }

  // Either side can end it: the owner revokes access, or the caregiver
  // leaves / declines.
  async remove(id: string, userId: string) {
    const link = await this.linksRepo.findOne({ where: { id } });
    if (!link) throw new NotFoundException('Not found');
    if (link.ownerId !== userId && link.caregiverId !== userId) throw new ForbiddenException();
    await this.linksRepo.delete(id);
  }

  // Every patient (of other accounts) this user may act for through an
  // accepted family-access link — only the people each owner chose.
  async sharedPatientIds(caregiverId: string): Promise<string[]> {
    const rows = (await this.dataSource.query(
      `SELECT p.id
         FROM care_links cl
         JOIN patients p ON p.account_id = cl.owner_id
        WHERE cl.caregiver_id = $1 AND cl.status = 'ACTIVE'
          AND (cl.patient_ids IS NULL OR p.id = ANY(cl.patient_ids))`,
      [caregiverId],
    )) as Array<{ id: string }>;
    return rows.map((r) => r.id);
  }

  async canCaregiverAccess(patientId: string, ownerId: string, caregiverId: string): Promise<boolean> {
    const link = await this.linksRepo.findOne({ where: { ownerId, caregiverId, status: 'ACTIVE' } });
    return !!link && (link.patientIds === null || link.patientIds.includes(patientId));
  }
}
