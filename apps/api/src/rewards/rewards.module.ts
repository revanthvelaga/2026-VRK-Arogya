import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Coupon } from './entities/coupon.entity';
import { WalletTransaction } from './entities/wallet-transaction.entity';
import { User } from '../users/user.entity';
import { CouponsService } from './coupons.service';
import { WalletService } from './wallet.service';
import { RewardsController } from './rewards.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Coupon, WalletTransaction, User])],
  controllers: [RewardsController],
  providers: [CouponsService, WalletService],
  exports: [CouponsService, WalletService],
})
export class RewardsModule {}
