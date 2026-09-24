import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
  async notify(userId: string, type: NotificationType, message: string): Promise<Notification> {
    const notification = await this.notificationsRepo.save(
      this.notificationsRepo.create({ userId, type, message }),
    );

    this.deliverEmail(notification, type).catch((err) => {
      this.logger.warn(
        `Email delivery failed for notification ${notification.id}: ${(err as Error).message}`,
      );
    });

    return notification;
  }

  private async deliverEmail(notification: Notification, type: NotificationType): Promise<void> {
    const user = await this.usersService.findById(notification.userId);
    if (!user?.email) return; // no email on file — the in-app notification is still real and already saved

    const { previewUrl } = await this.emailChannel.send(user.email, SUBJECTS[type], notification.message);
    notification.emailSent = true;
    notification.emailPreviewUrl = previewUrl;
    await this.notificationsRepo.save(notification);
  }

  findMine(userId: string): Promise<Notification[]> {
    return this.notificationsRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async markRead(id: string, userId: string): Promise<Notification> {
    const notification = await this.notificationsRepo.findOne({ where: { id } });
    if (!notification) throw new NotFoundException('Notification not found');
    if (notification.userId !== userId) throw new ForbiddenException('Not your notification');
    notification.readAt = new Date();
    return this.notificationsRepo.save(notification);
  }
}
