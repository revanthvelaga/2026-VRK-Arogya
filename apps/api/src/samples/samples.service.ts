import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Sample } from './entities/sample.entity';
import { SampleStatusHistory } from './entities/sample-status-history.entity';
import { SampleImage, SampleImageKind } from './entities/sample-image.entity';
import { UpdateSampleStatusDto } from './dto/update-sample-status.dto';
import { SampleStatus } from '../common/enums/sample-status.enum';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { BookingsService } from '../bookings/bookings.service';
import { PartnerLabsService } from '../partner-labs/partner-labs.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../common/enums/notification-type.enum';

export type SlaStatus = 'NOT_TRACKED' | 'IN_PROGRESS' | 'AT_RISK' | 'ON_TIME' | 'BREACHED';

export interface SampleSlaRow {
  sampleId: string;
  bookingId: string;
  status: SampleStatus;
  expectedResultAt: Date | null;
  actualResultAt: Date | null;
  slaStatus: SlaStatus;
}

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

// How much slack either side of the scheduled slot still counts as "on
// time" for an agent's performance record.
const ON_TIME_GRACE_MS = 30 * 60 * 1000;

@Injectable()
export class SamplesService {
  constructor(
    @InjectRepository(Sample)
    private readonly samplesRepo: Repository<Sample>,
    @InjectRepository(SampleStatusHistory)
    private readonly historyRepo: Repository<SampleStatusHistory>,
    @InjectRepository(SampleImage)
    private readonly imagesRepo: Repository<SampleImage>,
    private readonly dataSource: DataSource,
    private readonly bookingsService: BookingsService,
    private readonly partnerLabsService: PartnerLabsService,
    private readonly notificationsService: NotificationsService,
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
    // Fetched once here (not just for the notification below) so the
    // on-time check below has the booking's scheduledAt to compare against.
    let booking = dto.status === SampleStatus.COLLECTED || dto.status === SampleStatus.RESULT_READY
      ? await this.bookingsService.findOne(sample.bookingId)
      : undefined;

    if (dto.status === SampleStatus.COLLECTED) {
      sample.collectedBy = staffUserId;
      sample.collectedAt = new Date();
      // "On time" means within half an hour of the scheduled slot, either
      // side — a strict "at or after" would penalize an agent for arriving
      // early, which isn't the failure mode this is meant to catch.
      sample.onTimeCollection =
        Math.abs(sample.collectedAt.getTime() - booking!.scheduledAt.getTime()) <= ON_TIME_GRACE_MS;
      // Each defaults to false (not left unset) when omitted — an agent who
      // skips the checklist shows up as non-compliant, not "unknown".
      sample.safetyIdVerified = dto.idVerified ?? false;
      sample.safetyPpeUsed = dto.ppeUsed ?? false;
      sample.safetyHygieneFollowed = dto.hygieneFollowed ?? false;
      if (dto.barcode) sample.sampleBarcode = dto.barcode;
      await this.bookingsService.confirmIfPending(sample.bookingId);
    }

    if (dto.status === SampleStatus.ROUTED_TO_PARTNER_LAB) {
      if (!dto.partnerLabId) {
        throw new BadRequestException(
          'partnerLabId is required when routing a sample to a partner lab',
        );
      }
      const partnerLab = await this.partnerLabsService.findOne(dto.partnerLabId);
      sample.routedToPartnerLabId = partnerLab.id;
      const turnaroundHours = dto.turnaroundHoursOverride ?? partnerLab.defaultTurnaroundHours;
      sample.expectedResultAt = new Date(Date.now() + turnaroundHours * 60 * 60 * 1000);
    } else if (dto.status === SampleStatus.IN_HOUSE_PROCESSING && dto.turnaroundHoursOverride) {
      // In-house SLA targets aren't looked up from the catalog automatically
      // (a booking item may be a package, which has no single turnaround
      // figure) — staff can set one explicitly when it matters.
      sample.expectedResultAt = new Date(
        Date.now() + dto.turnaroundHoursOverride * 60 * 60 * 1000,
      );
    }

    const saved = await this.dataSource.transaction(async (manager) => {
      const savedSample = await manager.save(Sample, sample);
      await manager.save(
        SampleStatusHistory,
        manager.create(SampleStatusHistory, {
          sampleId: id,
          status: dto.status,
          changedBy: staffUserId,
          notes: dto.notes,
        }),
      );
      return savedSample;
    });

    // Only the two milestones a customer actually cares about — not every
    // intermediate transit/at-center step.
    if (dto.status === SampleStatus.COLLECTED || dto.status === SampleStatus.RESULT_READY) {
      booking ??= await this.bookingsService.findOne(saved.bookingId);
      const type =
        dto.status === SampleStatus.COLLECTED
          ? NotificationType.SAMPLE_COLLECTED
          : NotificationType.RESULT_READY;
      const message =
        dto.status === SampleStatus.COLLECTED
          ? 'Your sample has been collected and is on its way to the lab.'
          : 'Your results are ready — open your booking to view or download the report.';
      await this.notificationsService.notify(booking.customerId, type, message, booking.patientId);
    }

    return saved;
  }

  async getHistory(id: string, user: AuthenticatedUser): Promise<SampleStatusHistory[]> {
    const sample = await this.findOne(id);
    await this.bookingsService.findOneForUser(sample.bookingId, user);
    return this.historyRepo.find({ where: { sampleId: id }, order: { changedAt: 'ASC' } });
  }

  // Proof photos an agent captures in the field — a collection shot (the
  // sample/label at pickup) or a drop-off shot (handoff at the center).
  // STAFF/ADMIN only, same as updateStatus — the agent UI calls this right
  // alongside the status transition it documents.
  async uploadImage(
    sampleId: string,
    kind: SampleImageKind,
    uploadedBy: string,
    file: Express.Multer.File,
  ): Promise<Omit<SampleImage, 'imageData' | 'sample'>> {
    await this.findOne(sampleId); // 404s if the sample doesn't exist
    const image = await this.imagesRepo.save(
      this.imagesRepo.create({
        sampleId,
        kind,
        imageData: file.buffer,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        uploadedBy,
      }),
    );
    const { imageData: _imageData, ...rest } = image;
    return rest;
  }

  async listImages(sampleId: string, user: AuthenticatedUser): Promise<Array<Omit<SampleImage, 'imageData' | 'sample'>>> {
    const sample = await this.findOne(sampleId);
    await this.bookingsService.findOneForUser(sample.bookingId, user); // ownership check
    const images = await this.imagesRepo.find({
      where: { sampleId },
      select: ['id', 'sampleId', 'kind', 'mimeType', 'sizeBytes', 'uploadedBy', 'createdAt'],
      order: { createdAt: 'ASC' },
    });
    return images;
  }

  async getImageForDownload(imageId: string, user: AuthenticatedUser): Promise<SampleImage> {
    const image = await this.imagesRepo.findOne({ where: { id: imageId } });
    if (!image) throw new NotFoundException('Image not found');
    const sample = await this.findOne(image.sampleId);
    await this.bookingsService.findOneForUser(sample.bookingId, user); // ownership check
    return image;
  }

  // Turnaround time, target vs. actual, for every sample ever routed to one
  // partner lab — the "SLA tracking" half of this step.
  async getSlaSummaryForPartnerLab(partnerLabId: string) {
    await this.partnerLabsService.findOne(partnerLabId); // 404s if the id is bad

    const samples = await this.samplesRepo.find({ where: { routedToPartnerLabId: partnerLabId } });

    const rows: SampleSlaRow[] = await Promise.all(
      samples.map(async (sample) => {
        const resultEntry = await this.historyRepo.findOne({
          where: { sampleId: sample.id, status: SampleStatus.RESULT_READY },
          order: { changedAt: 'ASC' },
        });
        const actualResultAt = resultEntry?.changedAt ?? null;

        let slaStatus: SlaStatus;
        if (!sample.expectedResultAt) {
          slaStatus = 'NOT_TRACKED';
        } else if (actualResultAt) {
          slaStatus = actualResultAt <= sample.expectedResultAt ? 'ON_TIME' : 'BREACHED';
        } else {
          slaStatus = new Date() > sample.expectedResultAt ? 'AT_RISK' : 'IN_PROGRESS';
        }

        return {
          sampleId: sample.id,
          bookingId: sample.bookingId,
          status: sample.status,
          expectedResultAt: sample.expectedResultAt ?? null,
          actualResultAt,
          slaStatus,
        };
      }),
    );

    const count = (s: SlaStatus) => rows.filter((r) => r.slaStatus === s).length;
    return {
      summary: {
        total: rows.length,
        onTime: count('ON_TIME'),
        breached: count('BREACHED'),
        atRisk: count('AT_RISK'),
        inProgress: count('IN_PROGRESS'),
        notTracked: count('NOT_TRACKED'),
      },
      samples: rows,
    };
  }
}
