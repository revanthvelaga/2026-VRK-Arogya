import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from './entities/booking.entity';
import { BookingItem } from './entities/booking-item.entity';
import { AgentRating } from './entities/agent-rating.entity';
import { VisitService } from './visit.service';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { CatalogModule } from '../catalog/catalog.module';
import { CentersModule } from '../centers/centers.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PatientsModule } from '../patients/patients.module';
import { UsersModule } from '../users/users.module';
import { RewardsModule } from '../rewards/rewards.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking, BookingItem, AgentRating]),
    CatalogModule,
    CentersModule,
    NotificationsModule,
    PatientsModule,
    UsersModule,
    RewardsModule,
  ],
  controllers: [BookingsController],
  providers: [BookingsService, VisitService],
  exports: [BookingsService, VisitService],
})
export class BookingsModule {}
