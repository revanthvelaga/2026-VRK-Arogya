import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DiagnosticCenter } from './entities/diagnostic-center.entity';
import { CreateCenterDto } from './dto/create-center.dto';
import { UpdateCenterDto } from './dto/update-center.dto';
import { toGeoPoint } from '../common/utils/geo.util';

@Injectable()
export class CentersService {
  constructor(
    @InjectRepository(DiagnosticCenter)
    private readonly centersRepo: Repository<DiagnosticCenter>,
  ) {}

  findAllActive(): Promise<DiagnosticCenter[]> {
    return this.centersRepo.find({ where: { isActive: true } });
  }

  async findOne(id: string): Promise<DiagnosticCenter> {
    const center = await this.centersRepo.findOne({ where: { id } });
    if (!center) throw new NotFoundException('Diagnostic center not found');
    return center;
  }

  create(dto: CreateCenterDto): Promise<DiagnosticCenter> {
    const center = this.centersRepo.create({
      name: dto.name,
      address: dto.address,
      location: toGeoPoint(dto.latitude, dto.longitude),
      serviceRadiusKm: dto.serviceRadiusKm ?? 20,
      ownerId: dto.ownerId,
    });
    return this.centersRepo.save(center);
  }

  async update(id: string, dto: UpdateCenterDto): Promise<DiagnosticCenter> {
    const center = await this.findOne(id);
    if (dto.name !== undefined) center.name = dto.name;
    if (dto.address !== undefined) center.address = dto.address;
    if (dto.serviceRadiusKm !== undefined) center.serviceRadiusKm = dto.serviceRadiusKm;
    if (dto.ownerId !== undefined) center.ownerId = dto.ownerId;
    if (dto.latitude !== undefined && dto.longitude !== undefined) {
      center.location = toGeoPoint(dto.latitude, dto.longitude);
    }
    return this.centersRepo.save(center);
  }

  async remove(id: string): Promise<void> {
    const center = await this.findOne(id);
    center.isActive = false;
    await this.centersRepo.save(center);
  }

  // Active centers whose service radius covers the given point, nearest first.
  findNearby(lat: number, lng: number): Promise<DiagnosticCenter[]> {
    return this.centersRepo
      .createQueryBuilder('center')
      .where('center.is_active = true')
      .andWhere(
        'ST_DWithin(center.location, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326), center.service_radius_km * 1000)',
        { lat, lng },
      )
      .orderBy(
        'ST_Distance(center.location, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326))',
        'ASC',
      )
      .getMany();
  }
}
