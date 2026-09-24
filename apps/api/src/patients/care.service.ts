import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CareLink } from './entities/care-link.entity';

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
    return {
      // People who can see my family's health.
      caregivers: links
        .filter((l) => l.ownerId === userId)
        .map((l) => ({ id: l.id, status: l.status, createdAt: l.createdAt, person: person(l.caregiverId) })),
      // Families I look after (or have been invited to).
      caringFor: links
        .filter((l) => l.caregiverId === userId)
        .map((l) => ({ id: l.id, status: l.status, createdAt: l.createdAt, person: person(l.ownerId) })),
    };
  }

  async invite(ownerId: string, rawPhone: string) {
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
    const link = await this.linksRepo.save(this.linksRepo.create({ ownerId, caregiverId: caregiver.id }));
    return { link, caregiverName: caregiver.full_name, caregiverId: caregiver.id };
  }

  async accept(id: string, userId: string) {
    const link = await this.linksRepo.findOne({ where: { id } });
    if (!link || link.caregiverId !== userId) throw new NotFoundException('Invitation not found');
    link.status = 'ACTIVE';
    link.acceptedAt = new Date();
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

  // Accounts whose family this user actively looks after.
  async ownersCaredForBy(caregiverId: string): Promise<string[]> {
    const links = await this.linksRepo.find({ where: { caregiverId, status: 'ACTIVE' } });
    return links.map((l) => l.ownerId);
  }

  async isActiveCaregiver(ownerId: string, caregiverId: string): Promise<boolean> {
    return this.linksRepo.exists({ where: { ownerId, caregiverId, status: 'ACTIVE' } });
  }
}
