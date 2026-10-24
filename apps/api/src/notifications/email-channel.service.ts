import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

export interface SendResult {
  previewUrl?: string;
}

// Real email delivery over real SMTP — never faked. With SMTP_HOST set,
// this uses your real provider; with nothing set, it falls back to a
// free, zero-signup Ethereal test account so the whole notification path
// works out of the box in dev, with a preview link to actually read what
// was sent. SMS/push aren't implemented here — Twilio (SMS) and Firebase
// Cloud Messaging (push) both need paid or platform-specific credentials
// this environment doesn't have; NotificationsService.notify() is the
// place to add a channel for either once those exist.
@Injectable()
export class EmailChannelService implements OnModuleInit {
  private readonly logger = new Logger(EmailChannelService.name);
  private transporter!: nodemailer.Transporter;
  private fromAddress = 'notifications@arogya.local';

  async onModuleInit(): Promise<void> {
    // Short timeouts on purpose: delivery already runs off the request
    // path (see NotificationsService.notify), but an unreachable or slow
    // SMTP host should still fail in seconds, not hang for nodemailer's
    // ~2 minute default while a background send keeps a Node event-loop
    // handle open.
    const timeouts = { connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 8000 };

    if (process.env.SMTP_HOST) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
        ...timeouts,
      });
      this.fromAddress = process.env.SMTP_FROM ?? this.fromAddress;
      this.logger.log(`Email channel using configured SMTP (${process.env.SMTP_HOST})`);
      return;
    }

    // No SMTP configured: fall back to an Ethereal test inbox. Creating one
    // is an HTTP call to Ethereal with no timeout of its own, so it must
    // never be awaited here — when Ethereal was slow, the whole API hung on
    // boot and nobody could sign in. Start it in the background with a hard
    // timeout; until it's ready (or if it fails) mail goes to a log-only
    // transport so sends never throw.
    this.transporter = nodemailer.createTransport({ jsonTransport: true });
    this.ready = this.setUpEtherealInBackground(timeouts);
  }

  private ready: Promise<void> = Promise.resolve();

  private async setUpEtherealInBackground(timeouts: Record<string, number>): Promise<void> {
    try {
      const testAccount = await Promise.race([
        nodemailer.createTestAccount(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Ethereal did not answer within 10s')), 10_000).unref(),
        ),
      ]);
      this.transporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: { user: testAccount.user, pass: testAccount.pass },
        ...timeouts,
      });
      this.logger.log(
        `Email channel ready — no SMTP_HOST set, using a throwaway Ethereal test inbox (${testAccount.user}). Set SMTP_HOST/SMTP_USER/SMTP_PASS to use a real provider.`,
      );
    } catch (err) {
      this.logger.warn(
        `Ethereal test inbox unavailable (${(err as Error).message}) — emails will only be logged. Set SMTP_HOST/SMTP_USER/SMTP_PASS to use a real provider.`,
      );
    }
  }

  async send(to: string, subject: string, text: string): Promise<SendResult> {
    await this.ready;
    const info = await this.transporter.sendMail({ from: this.fromAddress, to, subject, text });
    const previewUrl = nodemailer.getTestMessageUrl(info) || undefined;
    if (previewUrl) {
      this.logger.log(`Email to ${to} sent — preview: ${previewUrl}`);
    }
    return { previewUrl };
  }
}
