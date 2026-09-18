import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DiagnosticCenter } from './entities/diagnostic-center.entity';
import { PickupPoint } from './entities/pickup-point.entity';
import { PickupPointSchedule } from './entities/pickup-point-schedule.entity';
import { CentersService } from './centers.service';
import { PickupPointsService } from './pickup-points.service';
import { CentersController } from './centers.controller';
import { PickupPointsController } from './pickup-points.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([DiagnosticCenter, PickupPoint, PickupPointSchedule]),
  ],
  controllers: [CentersController, PickupPointsController],
  providers: [CentersService, PickupPointsService],
  exports: [CentersService, PickupPointsService],
})
export class CentersModule {}
