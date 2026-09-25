import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Report } from './entities/report.entity';
import { ReportValue } from './entities/report-value.entity';
import { AddReportValuesDto } from './dto/add-report-values.dto';
import { Booking } from '../bookings/entities/booking.entity';
import { BookingsService } from '../bookings/bookings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../common/enums/notification-type.enum';
import { Role } from '../common/enums/role.enum';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { TestsService } from '../catalog/tests.service';
import { AiService } from '../ai/ai.service';
import { PatientsService } from '../patients/patients.service';

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
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @InjectRepository(Report)
    private readonly reportsRepo: Repository<Report>,
    @InjectRepository(ReportValue)
    private readonly reportValuesRepo: Repository<ReportValue>,
    private readonly bookingsService: BookingsService,
    private readonly notificationsService: NotificationsService,
    private readonly testsService: TestsService,
    private readonly ai: AiService,
    private readonly patientsService: PatientsService,
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

  // Reports carry clinical results — unlike sample-collection duties, a
  // field agent (STAFF) has no legitimate reason to read them. Only the
  // booking's own customer or an ADMIN can view report metadata, values,
  // or bytes. STAFF keeps upload/addValues access elsewhere (that's a
  // back-office action, not a field-agent one) — this only locks down
  // the read side, on purpose.
  private async assertCanViewReports(bookingId: string, user: AuthenticatedUser): Promise<Booking> {
    const booking = await this.bookingsService.findOne(bookingId); // 404s if the booking doesn't exist
    if (user.role === Role.ADMIN) return booking;
    if (user.role === Role.CUSTOMER && (await this.bookingsService.isCustomerSide(booking, user.userId))) return booking;
    throw new ForbiddenException('Not authorized to view reports for this booking');
  }

  async findForBooking(bookingId: string, user: AuthenticatedUser): Promise<PublicReport[]> {
    await this.assertCanViewReports(bookingId, user);
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
    await this.assertCanViewReports(report.bookingId, user);
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
      .where(patientId ? 'b.patient_id = :patientId' : 'b.customer_id = :customerId', { customerId, patientId })
      .andWhere('r.generated_at < :before', { before: beforeGeneratedAt })
      .andWhere('rv.report_id != :currentReportId', { currentReportId })
      .orderBy('r.generated_at', 'DESC')
      .limit(1);

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
    // One patient's results are theirs whoever paid for the booking (a
    // caregiver, say) — so with a patient, filter on the patient after
    // checking this account may see them; without one, the customer's own.
    if (patientId) await this.patientsService.findOneForAccount(patientId, customerId);
    const qb = this.reportValuesRepo
      .createQueryBuilder('rv')
      .innerJoin('reports', 'r', 'r.id = rv.report_id')
      .innerJoin('bookings', 'b', 'b.id = r.booking_id')
      .addSelect('r.booking_id', 'booking_id')
      .addSelect('r.generated_at', 'report_generated_at')
      .addSelect('r.file_name', 'report_file_name')
      .addSelect('b.patient_id', 'patient_id')
      .orderBy('r.generated_at', 'DESC')
      .addOrderBy('rv.created_at', 'ASC');

    if (patientId) {
      qb.where('b.patient_id = :patientId', { patientId });
    } else {
      qb.where('b.customer_id = :customerId', { customerId });
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

  // A short, plain-language health recommendation generated from the
  // patient's latest report only — same "current snapshot" rule as the
  // frontend's health score, so a value that's since normalized doesn't
  // keep shaping today's advice. Nothing here is persisted; it's
  // regenerated fresh on each request.
  async getHealthRecommendation(
    customerId: string,
    patientId?: string,
  ): Promise<{ recommendation: string; basedOn: { reportFileName: string; reportGeneratedAt: Date } | null }> {
    if (!this.ai.enabled) {
      throw new BadRequestException('Health recommendations are not configured on this server (missing GEMINI_API_KEY)');
    }

    const values = await this.findAllValuesForCustomer(customerId, patientId);
    if (values.length === 0) {
      return {
        recommendation:
          "Once a lab report is uploaded for this patient, we'll generate a personalized recommendation here.",
        basedOn: null,
      };
    }

    const latestReportId = values[0].reportId;
    const latest = values.filter((v) => v.reportId === latestReportId);

    const lines = latest.map((v) => {
      const range =
        v.normalLow != null && v.normalHigh != null ? ` (normal ${v.normalLow}-${v.normalHigh} ${v.unit ?? ''})` : '';
      return `- ${v.testName}: ${v.value} ${v.unit ?? ''}${range} — ${v.isAbnormal ? 'OUT OF RANGE' : 'normal'}`;
    });

    const prompt = `Here are a patient's latest lab results:\n${lines.join('\n')}\n\nWrite a short, friendly health recommendation based on these results.`;

    const recommendation = await this.ai.text({
      system:
        'You are a friendly health assistant inside a diagnostic lab booking app, summarizing a lab report for a patient. ' +
        'Write 3-5 short sentences or bullet points of practical, general lifestyle guidance based on which parameters are ' +
        'out of range. Never name or suggest a specific diagnosis, medication, or dosage. Keep the tone warm and simple, no ' +
        'jargon. Always end with one line recommending they discuss the full results with their doctor.',
      prompt,
      maxTokens: 350,
    });

    return {
      recommendation,
      basedOn: { reportFileName: latest[0].reportFileName, reportGeneratedAt: latest[0].reportGeneratedAt },
    };
  }

  async findValues(id: string, user: AuthenticatedUser): Promise<ReportValueWithTrend[]> {
    const report = await this.reportsRepo.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');
    const booking = await this.assertCanViewReports(report.bookingId, user);

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

  // An explanation is the same for everyone looking at the same value, so
  // it's cached for the life of the process rather than paid for each time
  // the card is opened.
  private readonly explanationCache = new Map<string, string>();

  // "What does this number mean?" for one result, in plain words. General
  // education only — no diagnosis, no drugs.
  async explainValue(valueId: string, user: AuthenticatedUser): Promise<{ explanation: string }> {
    const value = await this.reportValuesRepo.findOne({ where: { id: valueId } });
    if (!value) throw new NotFoundException('Result not found');
    const report = await this.reportsRepo.findOne({ where: { id: value.reportId }, select: METADATA_COLUMNS });
    if (!report) throw new NotFoundException('Report not found');
    await this.assertCanViewReports(report.bookingId, user);

    const cached = this.explanationCache.get(valueId);
    if (cached) return { explanation: cached };

    const range =
      value.normalLow != null && value.normalHigh != null
        ? `normal range ${value.normalLow}–${value.normalHigh} ${value.unit ?? ''}`
        : 'no reference range recorded';
    const status = value.isAbnormal
      ? Number(value.value) < Number(value.normalLow ?? -Infinity)
        ? 'BELOW the normal range'
        : 'ABOVE the normal range'
      : 'within the normal range';

    const explanation = await this.ai.text({
      system:
        'You explain one lab result to a patient of an Indian diagnostic lab in simple, warm language a ' +
        'non-medical reader understands. Structure: what this test measures (1 sentence); what their value ' +
        'means (1-2 sentences); 2-3 short general lifestyle tips if it is out of range; one line suggesting ' +
        'questions to ask their doctor. Never diagnose, never name medicines or doses, no alarming tone. ' +
        'Under 120 words. Plain text with short lines, no markdown headings.',
      prompt: `Test: ${value.testName}${value.category ? ` (${value.category})` : ''}
Result: ${value.value} ${value.unit ?? ''}
${range}
This result is ${status}.`,
      maxTokens: 1200,
    });

    this.explanationCache.set(valueId, explanation);
    return { explanation };
  }
}
