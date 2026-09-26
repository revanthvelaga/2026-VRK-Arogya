import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VitalReading } from './entities/vital-reading.entity';
import { HealthGoal } from './entities/health-goal.entity';
import { Medicine } from './entities/medicine.entity';
import { RetestReminder } from './entities/retest-reminder.entity';
import { HealthService } from './health.service';
import { HealthTrackingController } from './health.controller';
import { PatientsModule } from '../patients/patients.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([VitalReading, HealthGoal, Medicine, RetestReminder]),
    PatientsModule,
    NotificationsModule,
    AiModule,
  ],
  controllers: [HealthTrackingController],
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthTrackingModule {}
