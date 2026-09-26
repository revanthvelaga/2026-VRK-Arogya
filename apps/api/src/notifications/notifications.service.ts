import { formatInr, formatIstDateTime } from '../common/utils/format.util';
import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { EmailChannelService } from './email-channel.service';
import { UsersService } from '../users/users.service';
import { NotificationType } from '../common/enums/notification-type.enum';

const SUBJECTS: Record<NotificationType, string> = {
  [NotificationType.BOOKING_CREATED]: 'Your Arogya booking is confirmed',
  [NotificationType.SAMPLE_COLLECTED]: 'Your sample has been collected',
  [NotificationType.RESULT_READY]: 'Your results are ready',
  [NotificationType.REPORT_READY]: 'Your report is ready to download',
  [NotificationType.ISSUE_UPDATED]: 'Update on the issue you raised',
  [NotificationType.AGENT_ON_THE_WAY]: 'Your sample collector is on the way',
  [NotificationType.PREP_REMINDER]: 'How to prepare for your test tomorrow',
  [NotificationType.RETEST_DUE]: 'A recheck is due',
  [NotificationType.CARE_INVITE]: 'You have been invited to family access',
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationsRepo: Repository<Notification>,
    private readonly usersService: UsersService,
    private readonly emailChannel: EmailChannelService,
  ) {}

  // Always writes the in-app notification first, and returns as soon as
  // that write completes — never blocking on email. This was originally
  // `await`-ed inline, on the reasoning that it kept the code simple and
  // any given failure would still be caught. That held right up until an
  // unreachable SMTP host (no raw-SMTP egress in this environment) turned
  // one booking's POST into a ~2 minute hang before its connection
  // attempt finally timed out — the try/catch prevented an error, not the
  // delay. A booking, sample-status update, or report upload must
  // complete at normal request speed whether or not email delivery ever
  // gets there, so it's fire-and-forget from here: `deliverEmail` runs in
  // the background and only ever updates the row once it's done.
  // `patientId` says who the update is about, so family-access
  // caregivers only get copies about the people shared with them.
  async notify(userId: string, type: NotificationType, message: string, patientId?: string | null): Promise<Notification> {
    const notification = await this.notificationsRepo.save(
      this.notificationsRepo.create({ userId, type, message }),
    );

    this.deliverEmail(notification, type).catch((err) => {
      this.logger.warn(
        `Email delivery failed for notification ${notification.id}: ${(err as Error).message}`,
      );
    });

    // Family access: caregivers get a copy of everything the account they
    // look after is told (bookings, agent on the way, reports, reminders).
    if (type !== NotificationType.CARE_INVITE) {
      this.mirrorToCaregivers(userId, type, message, patientId ?? null).catch((err) =>
        this.logger.warn(`Caregiver copy failed for ${userId}: ${(err as Error).message}`),
      );
    }

    return notification;
  }

  private async mirrorToCaregivers(
    ownerId: string,
    type: NotificationType,
    message: string,
    patientId: string | null,
  ): Promise<void> {
    // A caregiver sharing everyone gets every update; one sharing only
    // some people gets updates about those people only.
    const rows = (await this.notificationsRepo.query(
      `SELECT cl.caregiver_id, u.full_name
         FROM care_links cl JOIN users u ON u.id::text = cl.owner_id
        WHERE cl.owner_id = $1 AND cl.status = 'ACTIVE'
          AND (cl.patient_ids IS NULL OR ($2::uuid IS NOT NULL AND $2::uuid = ANY(cl.patient_ids)))`,
      [ownerId, patientId],
    )) as Array<{ caregiver_id: string; full_name: string }>;
    for (const r of rows) {
      const copy = await this.notificationsRepo.save(
        this.notificationsRepo.create({ userId: r.caregiver_id, type, message: `For ${r.full_name}: ${message}` }),
      );
      this.deliverEmail(copy, type).catch(() => undefined);
    }
  }

  private async deliverEmail(notification: Notification, type: NotificationType): Promise<void> {
    const user = await this.usersService.findById(notification.userId);
    if (!user?.email) return; // no email on file — the in-app notification is still real and already saved

    const { previewUrl } = await this.emailChannel.send(user.email, SUBJECTS[type], notification.message);
    notification.emailSent = true;
    notification.emailPreviewUrl = previewUrl;
    await this.notificationsRepo.save(notification);
  }

  // Booking confirmations written before times were formatted in India
  // time read "26/9/2026, 5:00:00 am … Total: ₹2827.28" (the server's UTC
  // clock, raw number). Rewrite those in place; new ones never match.
  async fixOldBookingMessages(): Promise<number> {
    const rows = (await this.notificationsRepo.query(
      `SELECT id, message FROM notifications WHERE message LIKE '%Your booking for %/%/%, %:%:% is confirmed. Total: ₹%'`,
    )) as Array<{ id: string; message: string }>;
    const re =
      /^(For [^:]+: )?Your booking for (\d{1,2})\/(\d{1,2})\/(\d{4}), (\d{1,2}):(\d{2}):\d{2}\s?(am|pm) is confirmed\. Total: ₹([\d.]+)\.$/i;
    let fixed = 0;
    for (const r of rows) {
      const m = re.exec(r.message);
      if (!m) continue;
      const [, prefix = '', d, mo, y, h, min, ap, total] = m;
      let hour = Number(h) % 12;
      if (ap.toLowerCase() === 'pm') hour += 12;
      const when = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), hour, Number(min)));
      const message = `${prefix}Your booking for ${formatIstDateTime(when)} is confirmed. Total: ${formatInr(total)}.`;
      await this.notificationsRepo.update(r.id, { message });
      fixed++;
    }
    return fixed;
  }

  // The bell shows the latest 50; older ones aren't worth scrolling to.
  findMine(userId: string): Promise<Notification[]> {
    return this.notificationsRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const res = await this.notificationsRepo.update({ userId, readAt: IsNull() }, { readAt: new Date() });
    return { updated: res.affected ?? 0 };
  }

  async markRead(id: string, userId: string): Promise<Notification> {
    const notification = await this.notificationsRepo.findOne({ where: { id } });
    if (!notification) throw new NotFoundException('Notification not found');
    if (notification.userId !== userId) throw new ForbiddenException('Not your notification');
    notification.readAt = new Date();
    return this.notificationsRepo.save(notification);
  }
}
