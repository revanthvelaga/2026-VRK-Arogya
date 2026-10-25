import { BadRequestException, HttpException, HttpStatus, Injectable, Logger, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import { Repository } from 'typeorm';
import { OtpChallenge } from './entities/otp-challenge.entity';

// Sign-in codes (and a few booking messages) over WhatsApp, using Meta's
// WhatsApp Business Cloud API directly — no SMS gateway, so no TRAI DLT
// registration. WhatsApp only DELIVERS the message; unlike an OTP product
// it neither makes nor checks codes. So this server makes a random 6-digit
// code, keeps only a keyed hash of it with an expiry and a try counter, and
// checks what the person types against that.
//
// Business-initiated WhatsApp messages must use a template Meta has
// approved. For the code that is an "Authentication" template (body
// "{{1}} is your verification code." plus a Copy-code button), named by
// WHATSAPP_OTP_TEMPLATE.

const HOUR_MS = 60 * 60 * 1000;
const MAX_WRONG = 5;

@Injectable()
export class WhatsAppService implements OnModuleInit {
  private readonly logger = new Logger(WhatsAppService.name);
  // In-memory is enough for send limits: they only need to hold within one
  // running server, and a restart merely resets the counters. The codes
  // themselves are in the database.
  private readonly byPhone = new Map<string, number[]>();
  private readonly byIp = new Map<string, number[]>();
  private globalSends: number[] = [];

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(OtpChallenge) private readonly challenges: Repository<OtpChallenge>,
  ) {}

  private get token() {
    return this.config.get<string>('WHATSAPP_ACCESS_TOKEN');
  }
  private get phoneNumberId() {
    return this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID');
  }
  private get otpTemplate() {
    return this.config.get<string>('WHATSAPP_OTP_TEMPLATE');
  }
  private get language() {
    return this.config.get<string>('WHATSAPP_TEMPLATE_LANG') ?? 'en';
  }
  private get expiryMinutes() {
    return Number(this.config.get('WHATSAPP_OTP_EXPIRY_MINUTES') ?? 10);
  }
  private get messagesUrl() {
    const base = (this.config.get<string>('WHATSAPP_BASE_URL') ?? 'https://graph.facebook.com').replace(/\/$/, '');
    const version = this.config.get<string>('WHATSAPP_API_VERSION') ?? 'v23.0';
    return `${base}/${version}/${this.phoneNumberId}/messages`;
  }

  // What is set up, for the admin page and the log: which way sign-in codes
  // go, and (only the NAMES of) any settings still missing.
  diagnostics(): { requested: boolean; active: boolean; missing: string[] } {
    const requested = this.config.get<string>('OTP_PROVIDER') === 'whatsapp';
    const missing = [
      ['WHATSAPP_ACCESS_TOKEN', this.token],
      ['WHATSAPP_PHONE_NUMBER_ID', this.phoneNumberId],
      ['WHATSAPP_OTP_TEMPLATE', this.otpTemplate],
    ]
      .filter(([, value]) => !value)
      .map(([name]) => name as string);
    return { requested, active: requested && missing.length === 0, missing };
  }

  onModuleInit() {
    const d = this.diagnostics();
    if (d.active) this.logger.log('Sign-in codes are sent on WhatsApp');
    else if (d.requested) this.logger.warn(`OTP_PROVIDER=whatsapp but ${d.missing.join(', ')} not set — sign-in codes still go by Firebase SMS`);
    else this.logger.log('Sign-in codes are sent by Firebase SMS (set OTP_PROVIDER=whatsapp to use WhatsApp)');
  }

  // The WhatsApp account can send at all (booking messages need only this).
  hasCredentials(): boolean {
    return Boolean(this.token && this.phoneNumberId);
  }

  // Sign-in codes go by WhatsApp only when switched on (OTP_PROVIDER=whatsapp)
  // and fully set up, so a half-finished setup can never lock people out of
  // OTP: it falls back to Firebase exactly as before.
  isActive(): boolean {
    return this.config.get<string>('OTP_PROVIDER') === 'whatsapp' && this.hasCredentials() && Boolean(this.otpTemplate);
  }

  private hash(phone: string, code: string): string {
    return createHmac('sha256', `${this.config.get<string>('JWT_ACCESS_SECRET')}::otp-code`).update(`${phone}:${code}`).digest('hex');
  }

  private prune(list: number[], windowMs: number): number[] {
    const cutoff = Date.now() - windowMs;
    return list.filter((t) => t > cutoff);
  }

  // Each message can cost money, so a number, a network address and the
  // whole server all have a ceiling.
  private checkLimits(phone: string, ip: string) {
    const perHour = Number(this.config.get('OTP_MAX_PER_PHONE_HOUR') ?? 5);
    const perIpHour = Number(this.config.get('OTP_MAX_PER_IP_HOUR') ?? 20);
    const globalHour = Number(this.config.get('OTP_MAX_PER_HOUR') ?? 300);

    const phoneList = this.prune(this.byPhone.get(phone) ?? [], HOUR_MS);
    const last = phoneList[phoneList.length - 1];
    if (last && Date.now() - last < 30_000) {
      const wait = Math.ceil((30_000 - (Date.now() - last)) / 1000);
      throw new HttpException(`Please wait ${wait} seconds before asking for another code.`, HttpStatus.TOO_MANY_REQUESTS);
    }
    if (phoneList.length >= perHour) {
      throw new HttpException('Too many codes for this number. Please try again in an hour or sign in with your password.', HttpStatus.TOO_MANY_REQUESTS);
    }
    const ipList = this.prune(this.byIp.get(ip) ?? [], HOUR_MS);
    if (ipList.length >= perIpHour) {
      throw new HttpException('Too many requests from this network. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }
    this.globalSends = this.prune(this.globalSends, HOUR_MS);
    if (this.globalSends.length >= globalHour) {
      this.logger.warn(`Hourly OTP cap (${globalHour}) reached — refusing new sends`);
      throw new ServiceUnavailableException('OTP sign-in is busy right now. Please use your password or try again later.');
    }
    return { phoneList, ipList };
  }

  // ---- Sign-in codes ----

  // Returns false when the number isn't on WhatsApp, so the site can send
  // the code by SMS instead (Firebase) rather than turn the person away.
  async send(phone: string, ip: string): Promise<boolean> {
    const { phoneList, ipList } = this.checkLimits(phone, ip);
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.challenges.upsert(
      { phone, codeHash: this.hash(phone, code), attempts: 0, expiresAt: new Date(Date.now() + this.expiryMinutes * 60_000) },
      ['phone'],
    );

    const sent = await this.post({
      messaging_product: 'whatsapp',
      to: `91${phone}`,
      type: 'template',
      template: {
        name: this.otpTemplate,
        language: { code: this.language },
        components: [
          { type: 'body', parameters: [{ type: 'text', text: code }] },
          // Authentication templates carry a Copy-code button that needs the code too.
          { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] },
        ],
      },
    });
    if (!sent.ok) {
      await this.challenges.delete({ phone }); // nothing was delivered, so no live code
      if (sent.errorCode === 131026) {
        // Counted against the network and the server (so the page can't be
        // used to probe who has WhatsApp) but not against the number.
        const at = Date.now();
        this.byIp.set(ip, [...ipList, at]);
        this.globalSends.push(at);
        return false;
      }
      throw new ServiceUnavailableException("We couldn't send the code right now. Please try again, or sign in with your password.");
    }
    // Count only sends WhatsApp accepted.
    const now = Date.now();
    this.byPhone.set(phone, [...phoneList, now]);
    this.byIp.set(ip, [...ipList, now]);
    this.globalSends.push(now);
    return true;
  }

  async verify(phone: string, otp: string): Promise<void> {
    const row = await this.challenges.findOne({ where: { phone } });
    if (!row) throw new BadRequestException('This code is no longer valid. Tap "Resend OTP" to get a new one.');
    if (row.expiresAt.getTime() < Date.now()) {
      await this.challenges.delete({ phone });
      throw new BadRequestException('This code has expired. Tap "Resend OTP" to get a new one.');
    }
    if (row.attempts >= MAX_WRONG) {
      throw new HttpException('Too many wrong codes. Please request a new code in a few minutes.', HttpStatus.TOO_MANY_REQUESTS);
    }
    const given = Buffer.from(this.hash(phone, otp));
    const real = Buffer.from(row.codeHash);
    if (given.length !== real.length || !timingSafeEqual(given, real)) {
      await this.challenges.increment({ phone }, 'attempts', 1);
      throw new BadRequestException('Incorrect code. Please check the message and try again.');
    }
    // Single use.
    await this.challenges.delete({ phone });
  }

  // ---- Booking messages (utility templates) ----

  // `params` fill the template's {{1}} {{2}} … in order. Returns false
  // (never throws) so a WhatsApp problem can't affect the booking behind it.
  async sendTemplate(templateName: string, phone: string, params: string[]): Promise<boolean> {
    if (!this.hasCredentials()) return false;
    // WhatsApp rejects newlines, tabs and long runs of spaces in a parameter.
    const clean = (s: string) => s.replace(/\s+/g, ' ').trim().slice(0, 200) || '-';
    const res = await this.post({
      messaging_product: 'whatsapp',
      to: `91${phone}`,
      type: 'template',
      template: {
        name: templateName,
        language: { code: this.language },
        components: [{ type: 'body', parameters: params.map((p) => ({ type: 'text', text: clean(p) })) }],
      },
    });
    return res.ok;
  }

  private async post(body: unknown): Promise<{ ok: boolean; errorCode?: number }> {
    try {
      const res = await fetch(this.messagesUrl, {
        method: 'POST',
        headers: { authorization: `Bearer ${this.token}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) return { ok: true };
      const err = (await res.json().catch(() => ({}))) as { error?: { code?: number; message?: string } };
      const code = err.error?.code;
      // Log the reason (never the message content): 190 = bad/expired access
      // token, 131030 = number not allowed while still in test mode,
      // 132001 = template name/language not approved.
      this.logger.warn(`WhatsApp send failed (HTTP ${res.status}, code ${code ?? '?'}): ${err.error?.message ?? ''}`);
      return { ok: false, errorCode: code };
    } catch (err) {
      this.logger.warn(`WhatsApp request failed: ${(err as Error).message}`);
      return { ok: false };
    }
  }
}
