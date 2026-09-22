import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Report } from './entities/report.entity';
import { ReportValue } from './entities/report-value.entity';
import { AddReportValuesDto } from './dto/add-report-values.dto';
import { BookingsService } from '../bookings/bookings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../common/enums/notification-type.enum';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { TestsService } from '../catalog/tests.service';

export type PublicReport = Omit<Report, 'fileData' | 'booking'>;

// Every column except the PDF bytes themselves — used for any query that
// lists reports rather than serving one for download, so listing a
// booking's reports doesn't pull megabytes of PDF data across the wire
// for every row just to show a filename and a date.
const METADATA_COLUMNS: (keyof Report)[] = [
  'id',
  'bookingId',
  'fileName',
  'mimeType',
  'sizeBytes',
  'uploadedBy',
  'generatedAt',
  'reviewedBy',
];

export interface ReportValueWithTrend extends ReportValue {
  previousValue?: number;
  previousUnit?: string;
  previousRecordedAt?: Date;
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Report)
    private readonly reportsRepo: Repository<Report>,
    @InjectRepository(ReportValue)
    private readonly reportValuesRepo: Repository<ReportValue>,
    private readonly bookingsService: BookingsService,
    private readonly notificationsService: NotificationsService,
    private readonly testsService: TestsService,
  ) {}

  async upload(
    bookingId: string,
    uploadedBy: string,
    file: Express.Multer.File,
    reportDate?: string,
  ): Promise<PublicReport> {
    const booking = await this.bookingsService.findOne(bookingId); // 404s if the booking doesn't exist

    const report = await this.reportsRepo.save(
      this.reportsRepo.create({
        bookingId,
        fileData: file.buffer,
        fileName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        uploadedBy,
        // Left unset, the generated_at column's own DB default ("now()")
        // takes over — only pass a value when staff actually back-dated it.
        ...(reportDate ? { generatedAt: new Date(reportDate) } : {}),
      }),
    );

    await this.notificationsService.notify(
      booking.customerId,
      NotificationType.REPORT_READY,
      `Your report for booking ${bookingId.slice(0, 8)} is ready to download.`,
    );

    return this.toPublic(report);
  }

  async findForBooking(bookingId: string, user: AuthenticatedUser): Promise<PublicReport[]> {
    await this.bookingsService.findOneForUser(bookingId, user); // ownership check — owner or ADMIN/STAFF
    const reports = await this.reportsRepo.find({
      where: { bookingId },
      select: METADATA_COLUMNS,
      order: { generatedAt: 'DESC' },
    });
    return reports.map((r) => this.toPublic(r));
  }

  async getForDownload(id: string, user: AuthenticatedUser): Promise<Report & { fileData: Buffer }> {
    const report = await this.reportsRepo.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');
    await this.bookingsService.findOneForUser(report.bookingId, user); // ownership check
    // A row created before the switch to bytea storage has no bytes to
    // serve — ask staff to re-upload rather than send an empty file.
    if (!report.fileData) {
      throw new NotFoundException('This report needs to be re-uploaded before it can be viewed or downloaded.');
    }
    return report as Report & { fileData: Buffer };
  }

  // Never leak the raw bytes to clients through a metadata response —
  // /reports/:id/download is the only way to actually get them.
  private toPublic(report: Report): PublicReport {
    const { fileData: _fileData, booking: _booking, ...rest } = report;
    return rest;
  }

  // Structured result values ("insights") — the numbers behind a report's
  // red/normal highlighting. Entered by staff (typed from the PDF, since
  // there's no OCR pipeline here) rather than parsed from the file itself.
  async addValues(id: string, user: AuthenticatedUser, dto: AddReportValuesDto): Promise<ReportValue[]> {
    const report = await this.reportsRepo.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');
    await this.bookingsService.findOneForUser(report.bookingId, user); // ownership check

    const rows: ReportValue[] = [];
    for (const entry of dto.values) {
      let normalLow: number | undefined;
      let normalHigh: number | undefined;
      let unit = entry.unit;
      let category = entry.category;

      if (entry.testId) {
        const test = await this.testsService.findOne(entry.testId);
        normalLow = test.normalRangeLow != null ? Number(test.normalRangeLow) : undefined;
        normalHigh = test.normalRangeHigh != null ? Number(test.normalRangeHigh) : undefined;
        unit = unit ?? test.normalRangeUnit;
        category = category ?? test.category;
      }

      const isAbnormal =
        (normalLow != null && entry.value < normalLow) ||
        (normalHigh != null && entry.value > normalHigh);

      rows.push(
        this.reportValuesRepo.create({
          reportId: id,
          testId: entry.testId,
          testName: entry.testName,
          category,
          value: entry.value,
          unit,
          normalLow,
          normalHigh,
          isAbnormal,
        }),
      );
    }

    return this.reportValuesRepo.save(rows);
  }

  // Same parameter from an earlier report for the same customer — powers the
  // "107 -> 108" trend display. Matched by testId when there is one (a
  // free-form entry has none, so those fall back to matching on testName).
  // Scoped to a single patient when known, so a multi-profile account never
  // shows one family member's trend arrow computed against another's value.
  // One query per value rather than a single batched query: report result
  // sets are small (a handful to a few dozen parameters), so the simplicity
  // is worth more here than the extra round trips.
  private async findPreviousValue(
    value: ReportValue,
    customerId: string,
    beforeGeneratedAt: Date,
    currentReportId: string,
    patientId?: string,
  ): Promise<ReportValue | null> {
    const qb = this.reportValuesRepo
      .createQueryBuilder('rv')
      .innerJoin('reports', 'r', 'r.id = rv.report_id')
      .innerJoin('bookings', 'b', 'b.id = r.booking_id')
      .where('b.customer_id = :customerId', { customerId })
      .andWhere('r.generated_at < :before', { before: beforeGeneratedAt })
      .andWhere('rv.report_id != :currentReportId', { currentReportId })
      .orderBy('r.generated_at', 'DESC')
      .limit(1);

    if (patientId) {
      qb.andWhere('b.patient_id = :patientId', { patientId });
    }
    if (value.testId) {
      qb.andWhere('rv.test_id = :testId', { testId: value.testId });
    } else {
      qb.andWhere('rv.test_id IS NULL').andWhere('rv.test_name = :testName', { testName: value.testName });
    }

    return qb.getOne();
  }

  // Every report value across every one of a customer's bookings, newest
  // report first — backs the Insights page's aggregate "your results" view
  // so a customer doesn't have to open each booking to see what's abnormal.
  // Each value also carries its trend against that same patient's previous
  // report (same computation as findValues, just across the whole portfolio
  // rather than one report), so a repeat test shows "108 -> 118" the moment
  // a second report lands, not just on the single-report detail view.
  async findAllValuesForCustomer(customerId: string, patientId?: string): Promise<
    Array<ReportValueWithTrend & { bookingId: string; reportGeneratedAt: Date; reportFileName: string }>
  > {
    const qb = this.reportValuesRepo
      .createQueryBuilder('rv')
      .innerJoin('reports', 'r', 'r.id = rv.report_id')
      .innerJoin('bookings', 'b', 'b.id = r.booking_id')
      .where('b.customer_id = :customerId', { customerId })
      .addSelect('r.booking_id', 'booking_id')
      .addSelect('r.generated_at', 'report_generated_at')
      .addSelect('r.file_name', 'report_file_name')
      .addSelect('b.patient_id', 'patient_id')
      .orderBy('r.generated_at', 'DESC')
      .addOrderBy('rv.created_at', 'ASC');

    if (patientId) {
      qb.andWhere('b.patient_id = :patientId', { patientId });
    }

    const rows = await qb.getRawAndEntities();

    return Promise.all(
      rows.entities.map(async (entity, i) => {
        const raw = rows.raw[i];
        const previous = await this.findPreviousValue(
          entity,
          customerId,
          raw.report_generated_at,
          entity.reportId,
          raw.patient_id ?? undefined,
        );
        return {
          ...entity,
          bookingId: raw.booking_id,
          reportGeneratedAt: raw.report_generated_at,
          reportFileName: raw.report_file_name,
          previousValue: previous ? Number(previous.value) : undefined,
          previousUnit: previous?.unit,
          previousRecordedAt: previous?.createdAt,
        };
      }),
    );
  }

  async findValues(id: string, user: AuthenticatedUser): Promise<ReportValueWithTrend[]> {
    const report = await this.reportsRepo.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');
    const booking = await this.bookingsService.findOneForUser(report.bookingId, user); // ownership check

    const values = await this.reportValuesRepo.find({ where: { reportId: id }, order: { createdAt: 'ASC' } });

    return Promise.all(
      values.map(async (v) => {
        const previous = await this.findPreviousValue(v, booking.customerId, report.generatedAt, id, booking.patientId);
        return {
          ...v,
          previousValue: previous ? Number(previous.value) : undefined,
          previousUnit: previous?.unit,
          previousRecordedAt: previous?.createdAt,
        };
      }),
    );
  }
}
