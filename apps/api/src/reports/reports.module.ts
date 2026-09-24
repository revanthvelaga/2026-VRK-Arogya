import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Report } from './entities/report.entity';
import { ReportValue } from './entities/report-value.entity';
import { ReportShare } from './entities/report-share.entity';
import { ReportSharesService } from './report-shares.service';
import { ReportSharesController } from './report-shares.controller';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { BookingsModule } from '../bookings/bookings.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CatalogModule } from '../catalog/catalog.module';
import { AiModule } from '../ai/ai.module';
import { PatientsModule } from '../patients/patients.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Report, ReportValue, ReportShare]),
    BookingsModule,
    NotificationsModule,
    CatalogModule,
    AiModule,
    PatientsModule,
  ],
  controllers: [ReportsController, ReportSharesController],
  providers: [ReportsService, ReportSharesService],
})
export class ReportsModule {}
