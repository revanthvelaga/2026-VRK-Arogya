import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';

@Controller()
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('bookings/:bookingId/payment/order')
  createOrder(@CurrentUser() user: AuthenticatedUser, @Param('bookingId') bookingId: string) {
    return this.paymentsService.createOrder(bookingId, user);
  }

  @Get('bookings/:bookingId/payments')
  findForBooking(@CurrentUser() user: AuthenticatedUser, @Param('bookingId') bookingId: string) {
    return this.paymentsService.findForBooking(bookingId, user);
  }

  @Post('payments/verify')
  verify(@CurrentUser() user: AuthenticatedUser, @Body() dto: VerifyPaymentDto) {
    return this.paymentsService.verify(dto, user);
  }
}
