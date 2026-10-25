import { BadRequestException, HttpException, HttpStatus, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// MSG91 is an Indian SMS provider. Unlike Firebase (where the browser
// talks to Google and hands us a signed token), here OUR server asks MSG91
// to text the code and later asks MSG91 whether the code the customer typed
// is right. MSG91 makes up, stores and expires the code itself.
//
// India requires every SMS template to be registered with TRAI's DLT; the
// DLT-approved template (with the ##OTP## variable) is added in the MSG91
// panel, which gives the MSG91_TEMPLATE_ID used below. The sender name
// (6-letter header) is part of that registration, not set here.

const HOUR_MS = 60 * 60 * 1000;
const WRONG_WINDOW_MS = 10 * 60 * 1000;

@Injectable()
export class Msg91Service {
  private readonly logger = new Logger(Msg91Service.name);
  // In-memory is enough: the limits only need to hold within one running
  // server, and a restart merely resets the counters.
  private readonly byPhone = new Map<string, number[]>();
  private readonly byIp = new Map<string, number[]>();
  private globalSends: number[] = [];
  // Wrong guesses per number: after MAX_WRONG in WRONG_WINDOW_MS the number
  // is locked, so a 6-digit code can't be brute-forced.
  private readonly wrong = new Map<string, number[]>();

  constructor(private readonly config: ConfigService) {}

  private get authKey() {
    return this.config.get<string>('MSG91_AUTH_KEY');
  }
  private get templateId() {
    return this.config.get<string>('MSG91_TEMPLATE_ID');
  }
  private get baseUrl() {
    return (this.config.get<string>('MSG91_BASE_URL') ?? 'https://control.msg91.com').replace(/\/$/, '');
  }

  hasAuthKey(): boolean {
    return Boolean(this.authKey);
  }

  // A transactional SMS (booking confirmed, reminder…) through MSG91's Flow
  // API. The wording is the DLT-approved template stored at MSG91; `vars`
  // fill its ##var1## ##var2## … placeholders. Returns false (never throws)
  // so an SMS problem can't affect the booking behind it.
  async sendTemplate(templateId: string, phone: string, vars: Record<string, string>): Promise<boolean> {
    if (!this.authKey) return false;
    try {
      const url = new URL(`${this.baseUrl}/api/v5/flow`);
      const body = await this.call(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authkey: this.authKey },
        body: JSON.stringify({ template_id: templateId, short_url: '0', recipients: [{ mobiles: `91${phone}`, ...vars }] }),
      });
      if (body.type !== 'success') this.logger.warn(`MSG91 SMS failed: ${body.message}`);
      return body.type === 'success';
    } catch {
      return false;
    }
  }

  // Used only when switched on (OTP_PROVIDER=msg91) *and* fully set up, so
  // a half-finished setup can never lock people out of OTP: it falls back
  // to Firebase exactly as before.
  isActive(): boolean {
    return this.config.get<string>('OTP_PROVIDER') === 'msg91' && Boolean(this.authKey && this.templateId);
  }

  private prune(list: number[], windowMs: number): number[] {
    const cutoff = Date.now() - windowMs;
    return list.filter((t) => t > cutoff);
  }

  // Each SMS costs money, so a number, a network address and the whole
  // server all have a ceiling.
  private checkLimits(phone: string, ip: string) {
    const perHour = Number(this.config.get('MSG91_MAX_PER_PHONE_HOUR') ?? 5);
    const perIpHour = Number(this.config.get('MSG91_MAX_PER_IP_HOUR') ?? 20);
    const globalHour = Number(this.config.get('MSG91_MAX_PER_HOUR') ?? 300);

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

  async send(phone: string, ip: string): Promise<void> {
    const { phoneList, ipList } = this.checkLimits(phone, ip);
    const url = new URL(`${this.baseUrl}/api/v5/otp`);
    url.searchParams.set('template_id', this.templateId!);
    url.searchParams.set('mobile', `91${phone}`);
    url.searchParams.set('authkey', this.authKey!);
    url.searchParams.set('otp_length', '6');
    url.searchParams.set('otp_expiry', String(this.config.get('MSG91_OTP_EXPIRY_MINUTES') ?? 10));

    const body = await this.call(url, { method: 'POST', headers: { 'content-type': 'application/json', authkey: this.authKey! }, body: '{}' });
    if (body.type !== 'success') {
      this.logger.warn(`MSG91 send failed for ${phone.slice(0, 2)}******${phone.slice(-2)}: ${body.message}`);
      throw new ServiceUnavailableException("We couldn't send the code right now. Please try again, or sign in with your password.");
    }
    // Count only sends MSG91 accepted. A fresh code gets a fresh set of tries.
    this.wrong.delete(phone);
    const now = Date.now();
    this.byPhone.set(phone, [...phoneList, now]);
    this.byIp.set(ip, [...ipList, now]);
    this.globalSends.push(now);
  }

  async verify(phone: string, otp: string): Promise<void> {
    const maxWrong = Number(this.config.get('MSG91_MAX_WRONG_ATTEMPTS') ?? 5);
    const recentWrong = this.prune(this.wrong.get(phone) ?? [], WRONG_WINDOW_MS);
    if (recentWrong.length >= maxWrong) {
      throw new HttpException('Too many wrong codes. Please wait 10 minutes, or request a new code later.', HttpStatus.TOO_MANY_REQUESTS);
    }
    try {
      await this.verifyWithMsg91(phone, otp);
    } catch (err) {
      if (err instanceof BadRequestException) this.wrong.set(phone, [...recentWrong, Date.now()]);
      throw err;
    }
    this.wrong.delete(phone);
  }

  private async verifyWithMsg91(phone: string, otp: string): Promise<void> {
    const url = new URL(`${this.baseUrl}/api/v5/otp/verify`);
    url.searchParams.set('mobile', `91${phone}`);
    url.searchParams.set('otp', otp);
    const body = await this.call(url, { method: 'GET', headers: { authkey: this.authKey! } });
    if (body.type === 'success') return;

    const msg = String(body.message ?? '').toLowerCase();
    if (msg.includes('expire')) {
      throw new BadRequestException('This code has expired. Tap "Resend OTP" to get a new one.');
    }
    if (msg.includes('not found') || msg.includes('already verified')) {
      throw new BadRequestException('This code is no longer valid. Tap "Resend OTP" to get a new one.');
    }
    throw new BadRequestException('Incorrect code. Please check the SMS and try again.');
  }

  private async call(url: URL, init: RequestInit): Promise<{ type?: string; message?: string }> {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch {
        return { type: 'error', message: `HTTP ${res.status}` };
      }
    } catch (err) {
      this.logger.warn(`MSG91 request failed: ${(err as Error).message}`);
      throw new ServiceUnavailableException("We couldn't reach the SMS service. Please try again in a moment.");
    }
  }
}
