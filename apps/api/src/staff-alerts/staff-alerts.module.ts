import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StaffAlert } from './staff-alert.entity';
import { StaffAlertsService } from './staff-alerts.service';
import { StaffAlertsController } from './staff-alerts.controller';

// Global so bookings, samples and users can raise alerts without module
// import cycles.
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([StaffAlert])],
  providers: [StaffAlertsService],
  controllers: [StaffAlertsController],
  exports: [StaffAlertsService],
})
export class StaffAlertsModule {}
