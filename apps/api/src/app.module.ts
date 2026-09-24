import { Logger, Module, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { InjectDataSource, TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as path from 'path';
import { seedDatabase } from './seed/seed';
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
import { GeocodeModule } from './geocode/geocode.module';
import { PatientsModule } from './patients/patients.module';
import { HolidaysModule } from './holidays/holidays.module';
import { AiModule } from './ai/ai.module';
import { RewardsModule } from './rewards/rewards.module';
import { HealthTrackingModule } from './health/health.module';
import { HealthController } from './health.controller';

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
      useFactory: (config: ConfigService) => {
        // A hosted Postgres (Supabase, Render, etc.) hands you one
        // connection string rather than five separate host/port/user
        // pieces — DATABASE_URL takes over when set, so a cloud deploy is
        // one env var instead of splitting the string apart by hand.
        // Those providers also require SSL and commonly present a cert
        // chain that isn't in Node's default trust store, hence
        // rejectUnauthorized: false — fine for this app's own connection
        // to its own database, not a statement about it being safe in
        // general.
        const databaseUrl = config.get<string>('DATABASE_URL');
        return {
          type: 'postgres' as const,
          ...(databaseUrl
            ? { url: databaseUrl, ssl: { rejectUnauthorized: false } }
            : {
                host: config.get<string>('DB_HOST', 'localhost'),
                port: config.get<number>('DB_PORT', 55432),
                username: config.get<string>('DB_USERNAME', 'arogya'),
                password: config.get<string>('DB_PASSWORD', 'arogya_dev_pw'),
                database: config.get<string>('DB_NAME', 'arogya'),
              }),
          autoLoadEntities: true,
          synchronize: true, // dev only — turn off once migrations are in place
          // `npm run dev` starts Postgres and the API together, and the
          // postgis image runs initdb on first boot. The default 30s retry
          // window expires before that finishes, leaving the API dead while
          // concurrently keeps the other panes alive.
          retryAttempts: 20,
          retryDelay: 3000,
        };
      },
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
    GeocodeModule,
    HolidaysModule,
    PatientsModule,
    AiModule,
    RewardsModule,
    HealthTrackingModule,
  ],
  controllers: [HealthController],
})
export class AppModule implements OnApplicationBootstrap {
  private readonly logger = new Logger(AppModule.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  // A fresh cloud database (Supabase, a new Render Postgres, etc.) has no
  // catalog/centers to book against, and there's no shell access on a free
  // hosting plan to run seed.cli.ts by hand — so the very first boot against
  // an empty database seeds itself. Every later boot sees existing rows and
  // does nothing, so this never clobbers real data once there is any.
  async onApplicationBootstrap() {
    const [{ count }] = await this.dataSource.query('SELECT COUNT(*)::int AS count FROM tests');
    if (count > 0) return;
    this.logger.log('Empty database detected on boot — running the catalog/centers seed once.');
    await seedDatabase(this.dataSource);
  }
}
