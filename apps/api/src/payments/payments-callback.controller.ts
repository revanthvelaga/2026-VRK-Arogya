import { Body, Controller, Post, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { PaymentsService } from './payments.service';

// Where Razorpay's redirect checkout lands after a payment (the Android app
// uses redirect mode). Razorpay POSTs a form here; we verify it and send the
// customer back to their booking on the website, marked paid or failed.
// No JWT guard: the Razorpay signature is the proof.
@Controller('payments')
export class PaymentsCallbackController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly config: ConfigService,
  ) {}

  @Post('callback')
  async callback(
    @Body() body: Record<string, unknown>,
    @Query('r') returnPath: string | undefined,
    @Res() res: Response,
  ) {
    const site = (this.config.get<string>('CUSTOMER_WEB_URL') ?? 'https://arogya-customer-web.onrender.com').replace(/\/$/, '');
    const orderId = String(body.razorpay_order_id ?? '');
    const paymentId = String(body.razorpay_payment_id ?? '');
    const signature = String(body.razorpay_signature ?? '');
    let ok = false;
    let bookingId: string | undefined;
    if (orderId && paymentId && signature) {
      ({ ok, bookingId } = await this.paymentsService.verifyFromRedirect(orderId, paymentId, signature));
    }
    // Only ever send people back to a path on our own site.
    const path = returnPath && /^\/[A-Za-z0-9/_-]*$/.test(returnPath) ? returnPath : bookingId ? `/bookings/${bookingId}` : '/bookings';
    res.redirect(303, `${site}${path}?${ok ? 'paid=1' : 'payfail=1'}`);
  }
}
