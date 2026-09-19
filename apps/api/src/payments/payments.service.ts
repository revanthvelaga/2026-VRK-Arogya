import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import Razorpay from 'razorpay';
import { Payment } from './entities/payment.entity';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { BookingsService } from '../bookings/bookings.service';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { PaymentStatus } from '../common/enums/payment-status.enum';

// Razorpay's test mode needs a real (free) account — sign up at
// dashboard.razorpay.com, switch to "Test Mode", and copy the Key
// Id/Secret from Settings > API Keys into RAZORPAY_KEY_ID/SECRET. With
// neither set, order creation fails with a clear 400 rather than a
// confusing crash — same "explicit over silent" approach as
// EmailChannelService's Ethereal fallback, just without a keyless test
// mode to fall back to (Razorpay has none).
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly razorpay: InstanceType<typeof Razorpay> | null;
  private readonly keySecret: string | undefined;

  constructor(
    @InjectRepository(Payment)
    private readonly paymentsRepo: Repository<Payment>,
    private readonly bookingsService: BookingsService,
    private readonly config: ConfigService,
  ) {
    const keyId = this.config.get<string>('RAZORPAY_KEY_ID');
    this.keySecret = this.config.get<string>('RAZORPAY_KEY_SECRET');
    this.razorpay =
      keyId && this.keySecret ? new Razorpay({ key_id: keyId, key_secret: this.keySecret }) : null;
    if (!this.razorpay) {
      this.logger.warn(
        'RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET not set — payment order creation will fail until configured.',
      );
    }
  }

  async createOrder(bookingId: string, user: AuthenticatedUser): Promise<{
    orderId: string;
    amount: number;
    currency: string;
    keyId: string;
  }> {
    if (!this.razorpay) {
      throw new BadRequestException(
        'Payments are not configured on this server (missing RAZORPAY_KEY_ID/SECRET)',
      );
    }

    const booking = await this.bookingsService.findOneForUser(bookingId, user);
    if (booking.paymentStatus === PaymentStatus.PAID) {
      throw new BadRequestException('This booking is already paid');
    }

    const amountPaise = Math.round(Number(booking.totalAmount) * 100);
    const order = await this.razorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: `booking_${bookingId.slice(0, 8)}_${Date.now()}`,
    });

    await this.paymentsRepo.save(
      this.paymentsRepo.create({
        bookingId,
        razorpayOrderId: order.id,
        amount: booking.totalAmount,
        currency: 'INR',
        status: PaymentStatus.PENDING,
      }),
    );

    return {
      orderId: order.id,
      amount: amountPaise,
      currency: 'INR',
      keyId: this.config.get<string>('RAZORPAY_KEY_ID') as string,
    };
  }

  async verify(dto: VerifyPaymentDto, user: AuthenticatedUser): Promise<Payment> {
    const payment = await this.paymentsRepo.findOne({
      where: { razorpayOrderId: dto.razorpayOrderId },
    });
    if (!payment) throw new NotFoundException('Payment order not found');

    // Ownership check reuses the same booking-owner-or-staff rule as
    // everything else — a customer can only verify their own payment.
    await this.bookingsService.findOneForUser(payment.bookingId, user);

    if (!this.keySecret) {
      throw new BadRequestException('Payments are not configured on this server');
    }

    const expectedSignature = crypto
      .createHmac('sha256', this.keySecret)
      .update(`${dto.razorpayOrderId}|${dto.razorpayPaymentId}`)
      .digest('hex');

    if (expectedSignature !== dto.razorpaySignature) {
      payment.status = PaymentStatus.FAILED;
      await this.paymentsRepo.save(payment);
      throw new ForbiddenException('Payment signature verification failed');
    }

    payment.razorpayPaymentId = dto.razorpayPaymentId;
    payment.razorpaySignature = dto.razorpaySignature;
    payment.status = PaymentStatus.PAID;
    await this.paymentsRepo.save(payment);

    await this.bookingsService.setPaymentStatus(payment.bookingId, PaymentStatus.PAID);

    return payment;
  }

  async findForBooking(bookingId: string, user: AuthenticatedUser): Promise<Payment[]> {
    await this.bookingsService.findOneForUser(bookingId, user);
    return this.paymentsRepo.find({ where: { bookingId }, order: { createdAt: 'DESC' } });
  }
}
