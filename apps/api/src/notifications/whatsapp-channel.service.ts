import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WhatsAppService } from '../otp-settings/whatsapp.service';
import { UsersService } from '../users/users.service';
import { NotificationType } from '../common/enums/notification-type.enum';

// Booking messages on WhatsApp (not sign-in codes). Only the few messages
// people genuinely need — a booking confirmation and reminders — and only
// when that message type has a Meta-approved "Utility" template configured:
//
//   WHATSAPP_TPL_BOOKING_CREATED   {{1}} name, {{2}} date/time, {{3}} booking no.
//   WHATSAPP_TPL_PREP_REMINDER     {{1}} name, {{2}} date/time
//   WHATSAPP_TPL_REPORT_READY      {{1}} name, {{2}} booking no.
//
// Leave a template unset and that message is simply not sent. (Business
// messages like these should only go to people who agreed to get them on
// WhatsApp — say so where they give their number.)
const TEMPLATE_ENV: Partial<Record<NotificationType, string>> = {
  [NotificationType.BOOKING_CREATED]: 'WHATSAPP_TPL_BOOKING_CREATED',
  [NotificationType.PREP_REMINDER]: 'WHATSAPP_TPL_PREP_REMINDER',
  [NotificationType.REPORT_READY]: 'WHATSAPP_TPL_REPORT_READY',
};

@Injectable()
export class WhatsAppChannelService {
  private readonly logger = new Logger(WhatsAppChannelService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly whatsapp: WhatsAppService,
    private readonly users: UsersService,
  ) {}

  // `vars` are { var2, var3 } from the caller; the person's first name is
  // added as the first value.
  async send(userId: string, type: NotificationType, vars: Record<string, string> | undefined): Promise<void> {
    const envName = TEMPLATE_ENV[type];
    const template = envName ? this.config.get<string>(envName) : undefined;
    if (!template || !vars || !this.whatsapp.hasCredentials()) return;

    const user = await this.users.findById(userId);
    const phone = user?.phone?.replace(/\D/g, '').slice(-10);
    if (!phone || phone.length !== 10) return; // e.g. a Google sign-up with no number yet

    const firstName = (user!.fullName ?? '').trim().split(/\s+/)[0] || 'there';
    const params = [firstName, ...Object.keys(vars).sort().map((k) => vars[k])];
    const ok = await this.whatsapp.sendTemplate(template, phone, params);
    if (!ok) this.logger.warn(`WhatsApp message ${type} not sent`);
  }
}
