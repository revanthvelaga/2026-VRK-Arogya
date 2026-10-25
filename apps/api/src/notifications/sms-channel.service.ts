import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Msg91Service } from '../otp-settings/msg91.service';
import { UsersService } from '../users/users.service';
import { NotificationType } from '../common/enums/notification-type.enum';

// Transactional SMS (not OTPs) through MSG91. Only the few messages people
// genuinely need on a plain phone — a booking confirmation and reminders —
// and only when that message type has a DLT-approved template configured:
//
//   MSG91_TPL_BOOKING_CREATED   ##var1## name, ##var2## date/time, ##var3## booking no.
//   MSG91_TPL_PREP_REMINDER     ##var1## name, ##var2## date/time
//   MSG91_TPL_REPORT_READY      ##var1## name, ##var2## booking no.
//
// Leave a template id unset and that SMS is simply not sent.
const TEMPLATE_ENV: Partial<Record<NotificationType, string>> = {
  [NotificationType.BOOKING_CREATED]: 'MSG91_TPL_BOOKING_CREATED',
  [NotificationType.PREP_REMINDER]: 'MSG91_TPL_PREP_REMINDER',
  [NotificationType.REPORT_READY]: 'MSG91_TPL_REPORT_READY',
};

@Injectable()
export class SmsChannelService {
  private readonly logger = new Logger(SmsChannelService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly msg91: Msg91Service,
    private readonly users: UsersService,
  ) {}

  async send(userId: string, type: NotificationType, vars: Record<string, string> | undefined): Promise<void> {
    const envName = TEMPLATE_ENV[type];
    const templateId = envName ? this.config.get<string>(envName) : undefined;
    if (!templateId || !vars || !this.msg91.hasAuthKey()) return;

    const user = await this.users.findById(userId);
    const phone = user?.phone?.replace(/\D/g, '').slice(-10);
    if (!phone || phone.length !== 10) return; // e.g. a Google sign-up with no number yet

    const firstName = (user!.fullName ?? '').trim().split(/\s+/)[0] || 'there';
    const ok = await this.msg91.sendTemplate(templateId, phone, { var1: firstName, ...vars });
    if (!ok) this.logger.warn(`SMS ${type} not sent`);
  }
}
