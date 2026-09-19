import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Sample } from './entities/sample.entity';
import { SampleStatusHistory } from './entities/sample-status-history.entity';
import { UpdateSampleStatusDto } from './dto/update-sample-status.dto';
import { SampleStatus } from '../common/enums/sample-status.enum';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { BookingsService } from '../bookings/bookings.service';

// A sample can only move forward along the real specimen lifecycle — never
// backward, never skip a stage. AT_CENTER is the one branch point: an
// in-scope test stays in-house, an out-of-scope one is routed to the
// partner lab (step 7); both paths rejoin at RESULT_READY.
const ALLOWED_TRANSITIONS: Record<SampleStatus, SampleStatus[]> = {
  [SampleStatus.BOOKED]: [SampleStatus.COLLECTED],
  [SampleStatus.COLLECTED]: [SampleStatus.IN_TRANSIT_TO_CENTER],
  [SampleStatus.IN_TRANSIT_TO_CENTER]: [SampleStatus.AT_CENTER],
  [SampleStatus.AT_CENTER]: [
    SampleStatus.IN_HOUSE_PROCESSING,
    SampleStatus.ROUTED_TO_PARTNER_LAB,
  ],
  [SampleStatus.IN_HOUSE_PROCESSING]: [SampleStatus.RESULT_READY],
  [SampleStatus.ROUTED_TO_PARTNER_LAB]: [SampleStatus.RESULT_READY],
  [SampleStatus.RESULT_READY]: [SampleStatus.DELIVERED],
  [SampleStatus.DELIVERED]: [],
};

@Injectable()
export class SamplesService {
  constructor(
    @InjectRepository(Sample)
    private readonly samplesRepo: Repository<Sample>,
    @InjectRepository(SampleStatusHistory)
    private readonly historyRepo: Repository<SampleStatusHistory>,
    private readonly dataSource: DataSource,
    private readonly bookingsService: BookingsService,
  ) {}

  // One sample per booking item, seeded once a booking is confirmed —
  // there's nothing physical to track before that.
  async initializeForBooking(bookingId: string): Promise<Sample[]> {
    const booking = await this.bookingsService.findOne(bookingId);
    const existing = await this.samplesRepo.count({ where: { bookingId } });
    if (existing > 0) {
      throw new BadRequestException('Samples already initialized for this booking');
    }

    return this.dataSource.transaction(async (manager) => {
      const samples = booking.items.map((item) =>
        manager.create(Sample, {
          bookingId,
          bookingItemId: item.id,
          status: SampleStatus.BOOKED,
        }),
      );
      const saved = await manager.save(Sample, samples);

      const history = saved.map((sample) =>
        manager.create(SampleStatusHistory, {
          sampleId: sample.id,
          status: SampleStatus.BOOKED,
        }),
      );
      await manager.save(SampleStatusHistory, history);

      return saved;
    });
  }

  async findForBooking(bookingId: string, user: AuthenticatedUser): Promise<Sample[]> {
    // Reuses the booking's own ownership check: the owner, or STAFF/ADMIN.
    await this.bookingsService.findOneForUser(bookingId, user);
    return this.samplesRepo.find({ where: { bookingId }, order: { updatedAt: 'ASC' } });
  }

  async findOne(id: string): Promise<Sample> {
    const sample = await this.samplesRepo.findOne({ where: { id } });
    if (!sample) throw new NotFoundException('Sample not found');
    return sample;
  }

  async updateStatus(
    id: string,
    staffUserId: string,
    dto: UpdateSampleStatusDto,
  ): Promise<Sample> {
    const sample = await this.findOne(id);
    const allowedNext = ALLOWED_TRANSITIONS[sample.status];
    if (!allowedNext.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot move a sample from ${sample.status} to ${dto.status}`,
      );
    }

    sample.status = dto.status;
    if (dto.status === SampleStatus.COLLECTED) {
      sample.collectedBy = staffUserId;
      sample.collectedAt = new Date();
    }

    return this.dataSource.transaction(async (manager) => {
      const saved = await manager.save(Sample, sample);
      await manager.save(
        SampleStatusHistory,
        manager.create(SampleStatusHistory, {
          sampleId: id,
          status: dto.status,
          changedBy: staffUserId,
          notes: dto.notes,
        }),
      );
      return saved;
    });
  }

  async getHistory(id: string, user: AuthenticatedUser): Promise<SampleStatusHistory[]> {
    const sample = await this.findOne(id);
    await this.bookingsService.findOneForUser(sample.bookingId, user);
    return this.historyRepo.find({ where: { sampleId: id }, order: { changedAt: 'ASC' } });
  }
}
