import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CatalogModule } from './catalog/catalog.module';
import { CentersModule } from './centers/centers.module';
import { BookingsModule } from './bookings/bookings.module';
import { SamplesModule } from './samples/samples.module';
import { PartnerLabsModule } from './partner-labs/partner-labs.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ReportsModule } from './reports/reports.module';
import { PaymentsModule } from './payments/payments.module';
import { IssuesModule } from './issues/issues.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get('DB_USERNAME'),
        password: config.get('DB_PASSWORD'),
        database: config.get('DB_NAME'),
        autoLoadEntities: true,
        synchronize: true, // dev only — turn off once migrations are in place
      }),
    }),
    UsersModule,
    AuthModule,
    CatalogModule,
    CentersModule,
    BookingsModule,
    PartnerLabsModule,
    SamplesModule,
    NotificationsModule,
    ReportsModule,
    PaymentsModule,
    IssuesModule,
  ],
})
export class AppModule {}
