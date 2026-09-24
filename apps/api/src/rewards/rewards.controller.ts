import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CouponsService } from './coupons.service';
import { WalletService } from './wallet.service';
import { ApplyReferralDto, CreateCouponDto, UpdateCouponDto, ValidateCouponDto } from './dto/coupon.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import { AuthenticatedUser } from '../common/types/authenticated-user';

@Controller()
@UseGuards(JwtAuthGuard)
export class RewardsController {
  constructor(
    private readonly couponsService: CouponsService,
    private readonly walletService: WalletService,
  ) {}

  @Get('coupons/available')
  available() {
    return this.couponsService.findAvailable();
  }

  @Post('coupons/validate')
  validate(@CurrentUser() user: AuthenticatedUser, @Body() dto: ValidateCouponDto) {
    return this.couponsService.quote(dto.code, dto.subtotal, user.userId);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Get('coupons')
  findAll() {
    return this.couponsService.findAllForAdmin();
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Post('coupons')
  create(@Body() dto: CreateCouponDto) {
    return this.couponsService.create(dto);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Patch('coupons/:id')
  update(@Param('id') id: string, @Body() dto: UpdateCouponDto) {
    return this.couponsService.update(id, dto);
  }

  @Get('wallet/mine')
  wallet(@CurrentUser() user: AuthenticatedUser) {
    return this.walletService.getSummary(user.userId);
  }

  @Post('wallet/referral')
  async applyReferral(@CurrentUser() user: AuthenticatedUser, @Body() dto: ApplyReferralDto) {
    await this.walletService.applyReferral(user.userId, dto.code);
    return this.walletService.getSummary(user.userId);
  }
}
