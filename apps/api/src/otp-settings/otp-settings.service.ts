import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { AppSetting } from './entities/app-setting.entity';
import { OtpSendLog } from './entities/otp-send-log.entity';

const OTP_ENABLED_KEY = 'phone_otp_enabled';

export interface OtpStats {
  enabled: boolean;
  totalSends: number;
  sendsThisMonth: number;
  recent: Array<{ phone: string; purpose: string; createdAt: Date }>;
}

@Injectable()
export class OtpSettingsService {
  constructor(
    @InjectRepository(AppSetting)
    private readonly settingsRepo: Repository<AppSetting>,
    @InjectRepository(OtpSendLog)
    private readonly logRepo: Repository<OtpSendLog>,
  ) {}

  // No row yet = never toggled = on by default, same as before this
  // switch existed.
  async isEnabled(): Promise<boolean> {
    const row = await this.settingsRepo.findOne({ where: { key: OTP_ENABLED_KEY } });
    return row ? row.value === 'true' : true;
  }

  async setEnabled(enabled: boolean): Promise<void> {
    await this.settingsRepo.upsert({ key: OTP_ENABLED_KEY, value: String(enabled) }, ['key']);
  }

  // Fire-and-forget from the frontend right after Firebase confirms an
  // SMS actually went out — never blocks or fails the sign-in flow it's
  // riding along with.
  async logSend(phone: string, purpose: string): Promise<void> {
    await this.logRepo.save(this.logRepo.create({ phone, purpose }));
  }

  async getStats(): Promise<OtpStats> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [enabled, totalSends, sendsThisMonth, recent] = await Promise.all([
      this.isEnabled(),
      this.logRepo.count(),
      this.logRepo.count({ where: { createdAt: MoreThanOrEqual(startOfMonth) } }),
      this.logRepo.find({ order: { createdAt: 'DESC' }, take: 20 }),
    ]);

    return {
      enabled,
      totalSends,
      sendsThisMonth,
      recent: recent.map((r) => ({ phone: r.phone, purpose: r.purpose, createdAt: r.createdAt })),
    };
  }
}
