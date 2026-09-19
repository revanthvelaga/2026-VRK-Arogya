import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PartnerLab } from './entities/partner-lab.entity';
import { PartnerLabsService } from './partner-labs.service';
import { PartnerLabsController } from './partner-labs.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PartnerLab])],
  controllers: [PartnerLabsController],
  providers: [PartnerLabsService],
  exports: [PartnerLabsService],
})
export class PartnerLabsModule {}
