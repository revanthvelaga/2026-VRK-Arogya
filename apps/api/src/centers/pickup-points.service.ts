import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PickupPoint } from './entities/pickup-point.entity';
import { PickupPointSchedule } from './entities/pickup-point-schedule.entity';
import { DiagnosticCenter } from './entities/diagnostic-center.entity';
import { CreatePickupPointDto } from './dto/create-pickup-point.dto';
import { UpdatePickupPointDto } from './dto/update-pickup-point.dto';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { toGeoPoint } from '../common/utils/geo.util';

@Injectable()
export class PickupPointsService {
  constructor(
    @InjectRepository(PickupPoint)
    private readonly pickupPointsRepo: Repository<PickupPoint>,
    @InjectRepository(DiagnosticCenter)
    private readonly centersRepo: Repository<DiagnosticCenter>,
    @InjectRepository(PickupPointSchedule)
    private readonly schedulesRepo: Repository<PickupPointSchedule>,
  ) {}

  findAllForCenter(centerId: string): Promise<PickupPoint[]> {
    return this.pickupPointsRepo.find({ where: { centerId, isActive: true } });
  }

  async findOne(id: string): Promise<PickupPoint> {
    const point = await this.pickupPointsRepo.findOne({ where: { id } });
    if (!point) throw new NotFoundException('Pickup point not found');
    return point;
  }

  async create(dto: CreatePickupPointDto): Promise<PickupPoint> {
    const center = await this.centersRepo.findOne({ where: { id: dto.centerId } });
    if (!center) throw new NotFoundException('Diagnostic center not found');

    const distanceKm = await this.distanceKm(
      center.location.coordinates[1],
      center.location.coordinates[0],
      dto.latitude,
      dto.longitude,
    );
    this.assertWithinRadius(distanceKm, center);

    const point = this.pickupPointsRepo.create({
      centerId: dto.centerId,
      name: dto.name,
      location: toGeoPoint(dto.latitude, dto.longitude),
      villageName: dto.villageName,
      distanceKm,
    });
    return this.pickupPointsRepo.save(point);
  }

  async update(id: string, dto: UpdatePickupPointDto): Promise<PickupPoint> {
    const point = await this.findOne(id);
    if (dto.name !== undefined) point.name = dto.name;
    if (dto.villageName !== undefined) point.villageName = dto.villageName;

    if (dto.latitude !== undefined && dto.longitude !== undefined) {
      const center = await this.centersRepo.findOne({ where: { id: point.centerId } });
      if (!center) throw new NotFoundException('Diagnostic center not found');

      const distanceKm = await this.distanceKm(
        center.location.coordinates[1],
        center.location.coordinates[0],
        dto.latitude,
        dto.longitude,
      );
      this.assertWithinRadius(distanceKm, center);

      point.location = toGeoPoint(dto.latitude, dto.longitude);
      point.distanceKm = distanceKm;
    }

    return this.pickupPointsRepo.save(point);
  }

  async remove(id: string): Promise<void> {
    const point = await this.findOne(id);
    point.isActive = false;
    await this.pickupPointsRepo.save(point);
  }

  // Active pickup points within radiusKm of a given point, nearest first,
  // each annotated with its distance in km from that point.
  async findNearby(
    lat: number,
    lng: number,
    radiusKm = 20,
  ): Promise<Array<PickupPoint & { distanceKm: number }>> {
    const { entities, raw } = await this.pickupPointsRepo
      .createQueryBuilder('pp')
      .where('pp.is_active = true')
      .andWhere(
        'ST_DWithin(pp.location, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326), :radiusMeters)',
        { lat, lng, radiusMeters: radiusKm * 1000 },
      )
      .addSelect(
        'ST_Distance(pp.location, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)) / 1000',
        'distance_km',
      )
      .orderBy('distance_km', 'ASC')
      .getRawAndEntities();

    return entities.map((entity, i) => ({
      ...entity,
      distanceKm: parseFloat(raw[i].distance_km),
    }));
  }

  getSchedules(pickupPointId: string): Promise<PickupPointSchedule[]> {
    return this.schedulesRepo.find({ where: { pickupPointId } });
  }

  addSchedule(
    pickupPointId: string,
    dto: CreateScheduleDto,
  ): Promise<PickupPointSchedule> {
    const schedule = this.schedulesRepo.create({ pickupPointId, ...dto });
    return this.schedulesRepo.save(schedule);
  }

  async removeSchedule(id: string): Promise<void> {
    const result = await this.schedulesRepo.delete(id);
    if (!result.affected) throw new NotFoundException('Schedule not found');
  }

  private assertWithinRadius(distanceKm: number, center: DiagnosticCenter): void {
    if (distanceKm > center.serviceRadiusKm) {
      throw new BadRequestException(
        `Pickup point is ${distanceKm.toFixed(1)}km from "${center.name}", outside its ${center.serviceRadiusKm}km service radius`,
      );
    }
  }

  private async distanceKm(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): Promise<number> {
    const result = await this.pickupPointsRepo.manager.query(
      `SELECT ST_Distance(
         ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
         ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography
       ) / 1000 AS distance_km`,
      [lng1, lat1, lng2, lat2],
    );
    return parseFloat(result[0].distance_km);
  }
}
