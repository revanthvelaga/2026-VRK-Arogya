import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { randomInt } from 'crypto';
import { Booking } from './entities/booking.entity';
import { AgentRating } from './entities/agent-rating.entity';
import { BookingsService, BookingWithPeople } from './bookings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../common/enums/notification-type.enum';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { CollectionMode } from '../common/enums/collection-mode.enum';
import { Role } from '../common/enums/role.enum';
import { AuthenticatedUser } from '../common/types/authenticated-user';

const MAX_OTP_ATTEMPTS = 5;
// "8-10 hours fasting required" — a number of hours, so "No fasting
// required" never counts.
const FASTING_HOURS = /\d+\s*(-\s*\d+\s*)?hours? fasting/i;
const REMINDER_WINDOW_HOURS = 20;
const REMINDER_INTERVAL_MS = 15 * 60 * 1000;

export interface PreparationItem {
  testName: string;
  instructions: string;
}

export type CustomerBookingView = BookingWithPeople & {
  doorOtp?: string | null;
  preparation: PreparationItem[];
  myRating?: { rating: number; comment?: string };
};

// Everything about the collection visit itself, as opposed to the booking
// record: the agent's "on my way" + door-code handshake, the customer's
// rating afterwards, test preparation, and the day-before reminder.
@Injectable()
export class VisitService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VisitService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    @InjectRepository(Booking)
    private readonly bookingsRepo: Repository<Booking>,
    @InjectRepository(AgentRating)
    private readonly ratingsRepo: Repository<AgentRating>,
    private readonly bookingsService: BookingsService,
    private readonly notificationsService: NotificationsService,
    private readonly dataSource: DataSource,
  ) {}

  // Only the agent assigned to this booking (or an admin) may act on its
  // visit — another agent who can merely see the booking can't.
  private async assertVisitActor(bookingId: string, user: AuthenticatedUser): Promise<Booking> {
    const booking = await this.bookingsService.findOne(bookingId);
    if (user.role === Role.ADMIN) return booking;
    if (user.role === Role.STAFF && booking.assignedAgentId === user.userId) return booking;
    throw new ForbiddenException('Only the assigned agent can update this visit');
  }

  async markEnRoute(bookingId: string, etaMinutes: number, user: AuthenticatedUser) {
    const booking = await this.assertVisitActor(bookingId, user);
    if (booking.status === BookingStatus.CANCELLED || booking.status === BookingStatus.COMPLETED) {
      throw new BadRequestException(`This booking is ${booking.status.toLowerCase()}`);
    }
    if (booking.agentArrivedAt) throw new BadRequestException('Already checked in at the door');

    const otp = String(randomInt(0, 10000)).padStart(4, '0');
    const now = new Date();
    await this.bookingsRepo.update(bookingId, {
      agentEnRouteAt: now,
      agentEtaAt: new Date(now.getTime() + etaMinutes * 60_000),
      doorOtp: otp,
      doorOtpAttempts: 0,
    });

    const [agent] = (await this.dataSource.query(`SELECT full_name FROM users WHERE id = $1`, [
      booking.assignedAgentId ?? user.userId,
    ])) as Array<{ full_name: string }>;
    await this.notificationsService.notify(
      booking.customerId,
      NotificationType.AGENT_ON_THE_WAY,
      `${agent?.full_name ?? 'Your sample collector'} is on the way and should reach you in about ${etaMinutes} minutes. ` +
        `Share door code ${otp} with them when they arrive.`,
      booking.patientId,
    );
    return { agentEnRouteAt: now, agentEtaAt: new Date(now.getTime() + etaMinutes * 60_000) };
  }

  async verifyDoorOtp(bookingId: string, otp: string, user: AuthenticatedUser) {
    await this.assertVisitActor(bookingId, user);
    const row = await this.bookingsRepo
      .createQueryBuilder('b')
      .addSelect(['b.doorOtp', 'b.doorOtpAttempts'])
      .where('b.id = :id', { id: bookingId })
      .getOne();
    if (!row?.doorOtp) throw new BadRequestException('Tap "On my way" first so the customer gets a door code');
    if (row.agentArrivedAt) return { agentArrivedAt: row.agentArrivedAt };

    const attempts = row.doorOtpAttempts ?? 0;
    if (attempts >= MAX_OTP_ATTEMPTS) {
      throw new BadRequestException('Too many wrong codes — ask the admin to verify this visit');
    }
    if (row.doorOtp !== otp) {
      await this.bookingsRepo.update(bookingId, { doorOtpAttempts: attempts + 1 });
      const left = MAX_OTP_ATTEMPTS - attempts - 1;
      throw new BadRequestException(`That code doesn't match — ${left} ${left === 1 ? 'try' : 'tries'} left`);
    }
    const now = new Date();
    await this.bookingsRepo.update(bookingId, { agentArrivedAt: now });
    return { agentArrivedAt: now };
  }

  // Home-visit collections can only start once the agent has checked in
  // with the door code. Admins (working from the console, not at a door)
  // and centre/pickup-point collections aren't gated.
  async assertReadyToCollect(bookingId: string, user: AuthenticatedUser): Promise<void> {
    if (user.role === Role.ADMIN) return;
    const booking = await this.bookingsService.findOne(bookingId);
    if (booking.collectionMode === CollectionMode.HOME_VISIT && !booking.agentArrivedAt) {
      throw new BadRequestException("Check in with the customer's door code before starting collection");
    }
  }

  async rateAgent(bookingId: string, rating: number, comment: string | undefined, user: AuthenticatedUser) {
    const booking = await this.bookingsService.findOne(bookingId);
    if (user.role !== Role.CUSTOMER || !(await this.bookingsService.isCustomerSide(booking, user.userId))) {
      throw new ForbiddenException('Not your booking');
    }
    if (!booking.assignedAgentId) throw new BadRequestException('No agent was assigned to this booking');

    const [{ collected }] = (await this.dataSource.query(
      `SELECT COUNT(*)::int AS collected FROM samples WHERE booking_id = $1 AND collected_at IS NOT NULL`,
      [bookingId],
    )) as Array<{ collected: number }>;
    if (!booking.agentArrivedAt && collected === 0) {
      throw new BadRequestException('You can rate your agent once your sample has been collected');
    }

    const existing = await this.ratingsRepo.findOne({ where: { bookingId } });
    const saved = await this.ratingsRepo.save(
      this.ratingsRepo.create({
        ...(existing ?? {}),
        bookingId,
        agentId: booking.assignedAgentId,
        customerId: booking.customerId,
        rating,
        comment: comment?.trim() || undefined,
      }),
    );
    return { rating: saved.rating, comment: saved.comment };
  }

  async getPreparation(bookingId: string): Promise<PreparationItem[]> {
    const rows = (await this.dataSource.query(
      `SELECT DISTINCT t.name, t.preparation_instructions
         FROM booking_items bi
         LEFT JOIN package_tests pt ON pt.package_id::text = bi.package_id
         JOIN tests t ON t.id::text = COALESCE(bi.test_id, pt.test_id::text)
        WHERE bi.booking_id = $1 AND t.preparation_instructions IS NOT NULL
        ORDER BY t.name`,
      [bookingId],
    )) as Array<{ name: string; preparation_instructions: string }>;
    return rows.map((r) => ({ testName: r.name, instructions: r.preparation_instructions }));
  }

  // The customer's own view of their booking adds what only they should
  // see: the door code (while the agent is on the way), their rating, and
  // how to prepare.
  async decorateForCustomer(booking: BookingWithPeople, user: AuthenticatedUser): Promise<CustomerBookingView> {
    const preparation = await this.getPreparation(booking.id);
    // The door code and rating belong to the customer side — the payer,
    // the patient's own account, or a caregiver — never to staff.
    if (user.role !== Role.CUSTOMER || !(await this.bookingsService.isCustomerSide(booking, user.userId))) {
      return { ...booking, preparation };
    }

    const [otpRow, rating] = await Promise.all([
      booking.agentEnRouteAt && !booking.agentArrivedAt
        ? this.bookingsRepo
            .createQueryBuilder('b')
            .select('b.id')
            .addSelect('b.doorOtp')
            .where('b.id = :id', { id: booking.id })
            .getOne()
        : Promise.resolve(null),
      this.ratingsRepo.findOne({ where: { bookingId: booking.id } }),
    ]);
    return {
      ...booking,
      preparation,
      doorOtp: otpRow?.doorOtp ?? undefined,
      myRating: rating ? { rating: rating.rating, comment: rating.comment } : undefined,
    };
  }

  // ------------------------------------------------------------------
  // Day-before preparation reminder.
  // ------------------------------------------------------------------

  onModuleInit() {
    // No scheduler dependency needed for one job: a light timer that also
    // runs shortly after boot, so a host that sleeps between requests still
    // catches up when it wakes.
    if (process.env.NODE_ENV === 'test') return;
    setTimeout(() => void this.sendDuePrepReminders(), 30_000).unref();
    this.timer = setInterval(() => void this.sendDuePrepReminders(), REMINDER_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async sendDuePrepReminders(): Promise<number> {
    try {
      const now = new Date();
      const until = new Date(now.getTime() + REMINDER_WINDOW_HOURS * 3600_000);
      const due = await this.bookingsRepo
        .createQueryBuilder('b')
        .where('b.scheduled_at BETWEEN :now AND :until', { now, until })
        .andWhere('b.status IN (:...statuses)', { statuses: [BookingStatus.PENDING, BookingStatus.CONFIRMED] })
        .andWhere('b.prep_reminder_sent_at IS NULL')
        .getMany();

      for (const booking of due) {
        const prep = await this.getPreparation(booking.id);
        const when = booking.scheduledAt.toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          hour: 'numeric',
          minute: '2-digit',
        });
        const needsFasting = prep.some((p) => FASTING_HOURS.test(p.instructions));
        const lines = prep.map((p) => `• ${p.testName}: ${p.instructions}`).join('\n');
        const message =
          `Your test is on ${when}. ` +
          (needsFasting ? 'Some tests need fasting — only water for the hours listed below before your test. ' : '') +
          (lines ? `How to prepare:\n${lines}` : 'No special preparation needed.');

        // Claim the row first so two overlapping runs can't both send.
        const claimed = await this.bookingsRepo.update(
          { id: booking.id, prepReminderSentAt: IsNull() },
          { prepReminderSentAt: new Date() },
        );
        if (!claimed.affected) continue;
        await this.notificationsService.notify(booking.customerId, NotificationType.PREP_REMINDER, message, booking.patientId);
      }
      if (due.length) this.logger.log(`Sent ${due.length} preparation reminder(s)`);
      return due.length;
    } catch (err) {
      this.logger.error('Preparation reminder run failed', err instanceof Error ? err.stack : err);
      return 0;
    }
  }
}
