import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import { Report } from './entities/report.entity';
import { ReportValue } from './entities/report-value.entity';
import { AddReportValuesDto } from './dto/add-report-values.dto';
import { BookingsService } from '../bookings/bookings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../common/enums/notification-type.enum';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { TestsService } from '../catalog/tests.service';

export type PublicReport = Omit<Report, 'fileUrl' | 'booking'>;

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
  ): Promise<PublicReport> {
    const booking = await this.bookingsService.findOne(bookingId); // 404s if the booking doesn't exist

    const report = await this.reportsRepo.save(
      this.reportsRepo.create({
        bookingId,
        fileUrl: file.path,
        fileName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        uploadedBy,
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
      order: { generatedAt: 'DESC' },
    });
    return reports.map((r) => this.toPublic(r));
  }

  async getForDownload(id: string, user: AuthenticatedUser): Promise<Report> {
    const report = await this.reportsRepo.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');
    await this.bookingsService.findOneForUser(report.bookingId, user); // ownership check
    if (!fs.existsSync(report.fileUrl)) {
      throw new NotFoundException('Report file is missing from storage');
    }
    return report;
  }

  // Never leak the raw disk path to clients — /reports/:id/download is
  // the only way to actually get the bytes.
  private toPublic(report: Report): PublicReport {
    const { fileUrl: _fileUrl, booking: _booking, ...rest } = report;
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

      if (entry.testId) {
        const test = await this.testsService.findOne(entry.testId);
        normalLow = test.normalRangeLow != null ? Number(test.normalRangeLow) : undefined;
        normalHigh = test.normalRangeHigh != null ? Number(test.normalRangeHigh) : undefined;
        unit = unit ?? test.normalRangeUnit;
      }

      const isAbnormal =
        (normalLow != null && entry.value < normalLow) ||
        (normalHigh != null && entry.value > normalHigh);

      rows.push(
        this.reportValuesRepo.create({
          reportId: id,
          testId: entry.testId,
          testName: entry.testName,
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

  async findValues(id: string, user: AuthenticatedUser): Promise<ReportValue[]> {
    const report = await this.reportsRepo.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');
    await this.bookingsService.findOneForUser(report.bookingId, user); // ownership check
    return this.reportValuesRepo.find({ where: { reportId: id }, order: { createdAt: 'ASC' } });
  }
}
