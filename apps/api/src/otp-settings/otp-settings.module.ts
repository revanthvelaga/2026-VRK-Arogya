import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OtpSettingsController } from './otp-settings.controller';
import { OtpSettingsService } from './otp-settings.service';
import { WhatsAppService } from './whatsapp.service';
import { OtpChallenge } from './entities/otp-challenge.entity';
import { AppSetting } from './entities/app-setting.entity';
import { OtpSendLog } from './entities/otp-send-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AppSetting, OtpSendLog, OtpChallenge])],
  controllers: [OtpSettingsController],
  providers: [OtpSettingsService, WhatsAppService],
  exports: [OtpSettingsService, WhatsAppService],
})
export class OtpSettingsModule {}
