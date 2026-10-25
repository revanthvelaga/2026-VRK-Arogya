import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceToken } from './device-token.entity';
import { PushService } from './push.service';
import { PushController } from './push.controller';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([DeviceToken])],
  controllers: [PushController],
  providers: [PushService],
  exports: [PushService],
})
export class PushModule {}
