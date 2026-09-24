import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Patient } from './entities/patient.entity';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';
import { CareLink } from './entities/care-link.entity';
import { CareService } from './care.service';
import { CareController } from './care.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [TypeOrmModule.forFeature([Patient, CareLink]), NotificationsModule],
  controllers: [PatientsController, CareController],
  providers: [PatientsService, CareService],
  exports: [PatientsService, CareService],
})
export class PatientsModule {}
