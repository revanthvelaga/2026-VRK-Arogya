import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OtpSettingsController } from './otp-settings.controller';
import { OtpSettingsService } from './otp-settings.service';
import { Msg91Service } from './msg91.service';
import { AppSetting } from './entities/app-setting.entity';
import { OtpSendLog } from './entities/otp-send-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AppSetting, OtpSendLog])],
  controllers: [OtpSettingsController],
  providers: [OtpSettingsService, Msg91Service],
  exports: [OtpSettingsService, Msg91Service],
})
export class OtpSettingsModule {}
