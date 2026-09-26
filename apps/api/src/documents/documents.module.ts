import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerDocument } from './entities/customer-document.entity';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { PatientsModule } from '../patients/patients.module';

@Module({
  imports: [TypeOrmModule.forFeature([CustomerDocument]), PatientsModule],
  controllers: [DocumentsController],
  providers: [DocumentsService],
})
export class DocumentsModule {}
