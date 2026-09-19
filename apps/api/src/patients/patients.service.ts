import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Patient } from './entities/patient.entity';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { Relationship } from '../common/enums/relationship.enum';

@Injectable()
export class PatientsService {
  constructor(
    @InjectRepository(Patient)
    private readonly patientsRepo: Repository<Patient>,
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

  findAllForAccount(accountId: string): Promise<Patient[]> {
    return this.patientsRepo.find({ where: { accountId, isActive: true }, order: { createdAt: 'ASC' } });
  }

  async findOne(id: string): Promise<Patient> {
    const patient = await this.patientsRepo.findOne({ where: { id } });
    if (!patient) throw new NotFoundException('Patient not found');
    return patient;
  }

  async findOneForAccount(id: string, accountId: string): Promise<Patient> {
    const patient = await this.findOne(id);
    if (patient.accountId !== accountId) {
      throw new ForbiddenException('Not your patient profile');
    }
    return patient;
  }

  create(accountId: string, dto: CreatePatientDto): Promise<Patient> {
    const patient = this.patientsRepo.create({ accountId, ...dto });
    return this.patientsRepo.save(patient);
  }

  async update(id: string, accountId: string, dto: UpdatePatientDto): Promise<Patient> {
    const patient = await this.findOneForAccount(id, accountId);
    Object.assign(patient, dto);
    return this.patientsRepo.save(patient);
  }

  async remove(id: string, accountId: string): Promise<void> {
    const patient = await this.findOneForAccount(id, accountId);
    if (patient.relationship === Relationship.SELF) {
      throw new BadRequestException('Cannot remove your own patient profile');
    }
    patient.isActive = false;
    await this.patientsRepo.save(patient);
  }
}
