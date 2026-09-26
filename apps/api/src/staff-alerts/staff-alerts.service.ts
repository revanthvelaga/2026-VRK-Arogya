import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { StaffAlert } from './staff-alert.entity';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { Role } from '../common/enums/role.enum';
import { SampleStatus } from '../common/enums/sample-status.enum';

const SAMPLE_WORDS: Partial<Record<SampleStatus, string>> = {
  [SampleStatus.COLLECTED]: 'collected the sample for',
  [SampleStatus.IN_TRANSIT_TO_CENTER]: 'is taking to the centre the sample for',
  [SampleStatus.AT_CENTER]: 'dropped off at the centre the sample for',
  [SampleStatus.IN_HOUSE_PROCESSING]: 'started processing the sample for',
  [SampleStatus.ROUTED_TO_PARTNER_LAB]: 'sent to the partner lab the sample for',
  [SampleStatus.RESULT_READY]: 'marked results ready for',
  [SampleStatus.DELIVERED]: 'marked delivered the sample for',
};

@Injectable()
export class StaffAlertsService {
  private readonly logger = new Logger(StaffAlertsService.name);

  constructor(
    @InjectRepository(StaffAlert) private readonly alertsRepo: Repository<StaffAlert>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  // Called after an agent action succeeds. Only agents (STAFF) raise
  // alerts — an admin doing the same thing from the console doesn't need
  // to be told about it. Never throws: an alert failing mustn't undo or
  // slow the agent's action.
  record(actor: AuthenticatedUser, kind: string, describe: (agentName: string) => Promise<string> | string, link?: string) {
    if (actor.role !== Role.STAFF) return;
    this.write(actor.userId, kind, describe, link).catch((err) =>
      this.logger.warn(`Staff alert ${kind} failed: ${(err as Error).message}`),
    );
  }

  private async write(agentId: string, kind: string, describe: (agentName: string) => Promise<string> | string, link?: string) {
    const [agent] = (await this.dataSource.query(`SELECT full_name FROM users WHERE id = $1`, [agentId])) as Array<{
      full_name: string;
    }>;
    const message = await describe(agent?.full_name ?? 'An agent');
    const admins = (await this.dataSource.query(`SELECT id FROM users WHERE role = 'ADMIN'`)) as Array<{ id: string }>;
    if (!admins.length) return;
    await this.alertsRepo.save(admins.map((a) => this.alertsRepo.create({ userId: a.id, agentId, kind, message, link })));
  }

  // "Priya (today 4:30 PM)" style label for a booking.
  async bookingLabel(bookingId: string): Promise<string> {
    const [row] = (await this.dataSource.query(
      `SELECT COALESCE(p.full_name, u.full_name) AS name
         FROM bookings b
         LEFT JOIN patients p ON p.id::text = b.patient_id::text
         LEFT JOIN users u ON u.id::text = b.customer_id::text
        WHERE b.id::text = $1`,
      [bookingId],
    )) as Array<{ name: string | null }>;
    return row?.name ?? 'a customer';
  }

  sampleUpdate(actor: AuthenticatedUser, bookingId: string, status: SampleStatus) {
    const words = SAMPLE_WORDS[status];
    if (!words) return;
    this.record(
      actor,
      'SAMPLE_UPDATE',
      async (agent) => `${agent} ${words} ${await this.bookingLabel(bookingId)}.`,
      `/bookings/${bookingId}`,
    );
  }

  findMine(userId: string) {
    return this.alertsRepo.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 50 });
  }

  async markAllRead(userId: string) {
    const res = await this.alertsRepo.update({ userId, readAt: IsNull() }, { readAt: new Date() });
    return { updated: res.affected ?? 0 };
  }
}
