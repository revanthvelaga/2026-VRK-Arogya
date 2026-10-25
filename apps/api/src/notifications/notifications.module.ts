import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { EmailChannelService } from './email-channel.service';
import { UsersModule } from '../users/users.module';
import { PushModule } from '../push/push.module';
import { OtpSettingsModule } from '../otp-settings/otp-settings.module';
import { SmsChannelService } from './sms-channel.service';

@Module({
  imports: [TypeOrmModule.forFeature([Notification]), UsersModule, PushModule, OtpSettingsModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, EmailChannelService, SmsChannelService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
