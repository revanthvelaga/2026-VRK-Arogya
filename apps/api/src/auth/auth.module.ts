import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { GoogleAuthService } from './google-auth.service';
import { FirebasePhoneAuthService } from './firebase-phone-auth.service';
import { UsersModule } from '../users/users.module';
import { PatientsModule } from '../patients/patients.module';
import { RewardsModule } from '../rewards/rewards.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Passkey } from './entities/passkey.entity';
import { PasskeysService } from './passkeys.service';
import { PasskeysController } from './passkeys.controller';

@Module({
  imports: [
    UsersModule,
    PatientsModule,
    RewardsModule,
    PassportModule,
    ConfigModule,
    TypeOrmModule.forFeature([Passkey]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: config.get('JWT_ACCESS_EXPIRES_IN') },
      }),
    }),
  ],
  controllers: [AuthController, PasskeysController],
  providers: [AuthService, JwtStrategy, GoogleAuthService, FirebasePhoneAuthService, PasskeysService],
})
export class AuthModule {}
