import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from './entities/booking.entity';
import { BookingItem } from './entities/booking-item.entity';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { CatalogModule } from '../catalog/catalog.module';
import { CentersModule } from '../centers/centers.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PatientsModule } from '../patients/patients.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking, BookingItem]),
    CatalogModule,
    CentersModule,
    NotificationsModule,
    PatientsModule,
  ],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
