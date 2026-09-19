import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as path from 'path';
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
    ConfigModule.forRoot({
      isGlobal: true,
      // Resolved from this file, not the cwd, so the API finds its .env
      // whether it is started from apps/api or from the repo root.
      envFilePath: path.join(__dirname, '../.env'),
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get('DB_USERNAME', 'arogya'),
        password: config.get('DB_PASSWORD', 'arogya_dev_pw'),
        database: config.get('DB_NAME', 'arogya'),
        autoLoadEntities: true,
        synchronize: true, // dev only — turn off once migrations are in place
        // `npm run dev` starts Postgres and the API together, and the
        // postgis image runs initdb on first boot. The default 30s retry
        // window expires before that finishes, leaving the API dead while
        // concurrently keeps the other panes alive.
        retryAttempts: 20,
        retryDelay: 3000,
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
