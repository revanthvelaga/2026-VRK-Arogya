import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Test } from './entities/test.entity';
import { Package } from './entities/package.entity';
import { TestsService } from './tests.service';
import { PackagesService } from './packages.service';
import { TestsController } from './tests.controller';
import { PackagesController } from './packages.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Test, Package])],
  controllers: [TestsController, PackagesController],
  providers: [TestsService, PackagesService],
  exports: [TestsService, PackagesService],
})
export class CatalogModule {}
