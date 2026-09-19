import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sample } from './entities/sample.entity';
import { SampleStatusHistory } from './entities/sample-status-history.entity';
import { SamplesService } from './samples.service';
import { SamplesController } from './samples.controller';
import { BookingsModule } from '../bookings/bookings.module';
import { PartnerLabsModule } from '../partner-labs/partner-labs.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Sample, SampleStatusHistory]),
    BookingsModule,
    PartnerLabsModule,
    NotificationsModule,
  ],
  controllers: [SamplesController],
  providers: [SamplesService],
  exports: [SamplesService],
})
export class SamplesModule {}
