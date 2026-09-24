import { ForbiddenException, GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { ReportShare } from './entities/report-share.entity';
import { Report } from './entities/report.entity';
import { ReportValue } from './entities/report-value.entity';
import { BookingsService } from '../bookings/bookings.service';
import { AuthenticatedUser } from '../common/types/authenticated-user';

@Injectable()
export class ReportSharesService {
  constructor(
    @InjectRepository(ReportShare) private readonly sharesRepo: Repository<ReportShare>,
    @InjectRepository(Report) private readonly reportsRepo: Repository<Report>,
    @InjectRepository(ReportValue) private readonly valuesRepo: Repository<ReportValue>,
    private readonly bookingsService: BookingsService,
  ) {}

  // Only the patient's own account can share their report.
  private async assertOwner(reportId: string, user: AuthenticatedUser): Promise<Report> {
    const report = await this.reportsRepo.findOne({
      where: { id: reportId },
      select: ['id', 'bookingId', 'fileName', 'generatedAt'],
    });
    if (!report) throw new NotFoundException('Report not found');
    const booking = await this.bookingsService.findOne(report.bookingId);
    if (booking.customerId !== user.userId) throw new ForbiddenException('Only the patient can share this report');
    return report;
  }

  async create(reportId: string, days: number, user: AuthenticatedUser) {
    await this.assertOwner(reportId, user);
    const share = await this.sharesRepo.save(
      this.sharesRepo.create({
        reportId,
        createdBy: user.userId,
        token: randomBytes(24).toString('base64url'),
        expiresAt: new Date(Date.now() + days * 24 * 3600_000),
      }),
    );
    return share;
  }

  async listActive(reportId: string, user: AuthenticatedUser) {
    await this.assertOwner(reportId, user);
    return this.sharesRepo.find({
      where: { reportId, revokedAt: IsNull(), expiresAt: MoreThan(new Date()) },
      order: { createdAt: 'DESC' },
    });
  }

  async revoke(id: string, user: AuthenticatedUser) {
    const share = await this.sharesRepo.findOne({ where: { id } });
    if (!share) throw new NotFoundException('Link not found');
    await this.assertOwner(share.reportId, user);
    await this.sharesRepo.update(id, { revokedAt: new Date() });
  }

  private async resolve(token: string): Promise<ReportShare> {
    const share = await this.sharesRepo.findOne({ where: { token } });
    if (!share) throw new NotFoundException('This link is not valid');
    if (share.revokedAt || share.expiresAt.getTime() < Date.now()) {
      throw new GoneException('This link has expired — ask the patient for a new one');
    }
    return share;
  }

  // What a doctor sees on the shared page: the patient's first name (not
  // their phone or address), the report date and its values.
  async viewShared(token: string) {
    const share = await this.resolve(token);
    const report = await this.reportsRepo.findOne({
      where: { id: share.reportId },
      select: ['id', 'bookingId', 'fileName', 'generatedAt'],
    });
    if (!report) throw new NotFoundException('Report not found');
    const booking = await this.bookingsService.findOne(report.bookingId);
    const [patient] = booking.patientId
      ? ((await this.reportsRepo.query(`SELECT full_name, gender, date_of_birth FROM patients WHERE id::text = $1`, [
          booking.patientId,
        ])) as Array<{ full_name: string; gender: string | null; date_of_birth: string | null }>)
      : [];
    const values = await this.valuesRepo.find({ where: { reportId: report.id }, order: { createdAt: 'ASC' } });
    await this.sharesRepo.increment({ id: share.id }, 'viewCount', 1);

    const age = patient?.date_of_birth
      ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 24 * 3600_000))
      : null;
    return {
      patientName: patient?.full_name?.split(' ')[0] ?? 'Patient',
      patientGender: patient?.gender ?? null,
      patientAge: age,
      reportFileName: report.fileName,
      reportDate: report.generatedAt,
      expiresAt: share.expiresAt,
      values: values.map((v) => ({
        testName: v.testName,
        category: v.category,
        value: Number(v.value),
        unit: v.unit,
        normalLow: v.normalLow != null ? Number(v.normalLow) : null,
        normalHigh: v.normalHigh != null ? Number(v.normalHigh) : null,
        isAbnormal: v.isAbnormal,
      })),
    };
  }

  async sharedFile(token: string): Promise<Report & { fileData: Buffer }> {
    const share = await this.resolve(token);
    const report = await this.reportsRepo.findOne({ where: { id: share.reportId } });
    if (!report?.fileData) throw new NotFoundException('The report file is not available');
    return report as Report & { fileData: Buffer };
  }
}
