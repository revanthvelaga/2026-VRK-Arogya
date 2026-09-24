import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Coupon } from './entities/coupon.entity';
import { CreateCouponDto, UpdateCouponDto } from './dto/coupon.dto';

export interface CouponQuote {
  code: string;
  description: string;
  discount: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

@Injectable()
export class CouponsService {
  constructor(
    @InjectRepository(Coupon)
    private readonly couponsRepo: Repository<Coupon>,
    private readonly dataSource: DataSource,
  ) {}

  findAllForAdmin(): Promise<Coupon[]> {
    return this.couponsRepo.find({ order: { createdAt: 'DESC' } });
  }

  // What checkout shows as "Available offers". Per-customer limits aren't
  // checked here — the code is still validated in full when applied.
  async findAvailable(): Promise<Coupon[]> {
    const rows = await this.couponsRepo.find({ where: { isActive: true }, order: { createdAt: 'DESC' } });
    const now = Date.now();
    return rows.filter((c) => !c.validUntil || c.validUntil.getTime() > now);
  }

  async create(dto: CreateCouponDto): Promise<Coupon> {
    const code = dto.code.toUpperCase();
    if (await this.couponsRepo.findOne({ where: { code } })) {
      throw new ConflictException(`Coupon ${code} already exists`);
    }
    this.assertSane(dto.discountType, dto.value);
    return this.couponsRepo.save(
      this.couponsRepo.create({
        ...dto,
        code,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
      }),
    );
  }

  async update(id: string, dto: UpdateCouponDto): Promise<Coupon> {
    const coupon = await this.couponsRepo.findOne({ where: { id } });
    if (!coupon) throw new NotFoundException('Coupon not found');
    const { code, validUntil, ...rest } = dto;
    Object.assign(coupon, rest);
    if (code) coupon.code = code.toUpperCase();
    if (validUntil !== undefined) coupon.validUntil = validUntil ? new Date(validUntil) : null;
    this.assertSane(coupon.discountType, Number(coupon.value));
    return this.couponsRepo.save(coupon);
  }

  private assertSane(type: string, value: number) {
    if (type === 'PERCENT' && value > 100) throw new BadRequestException('A percentage discount cannot exceed 100');
  }

  // The single source of truth for what a code is worth on a given order:
  // used by the checkout preview and again, authoritatively, when the
  // booking is created (never trusting the preview's number).
  async quote(rawCode: string, subtotal: number, customerId: string): Promise<CouponQuote> {
    const code = rawCode.trim().toUpperCase();
    const coupon = await this.couponsRepo.findOne({ where: { code } });
    if (!coupon || !coupon.isActive) throw new BadRequestException(`"${code}" isn't a valid offer code`);
    if (coupon.validUntil && coupon.validUntil.getTime() < Date.now()) {
      throw new BadRequestException(`Offer ${code} has expired`);
    }
    if (subtotal < Number(coupon.minOrder)) {
      throw new BadRequestException(`${code} needs an order of at least ₹${Number(coupon.minOrder)}`);
    }

    // Cancelled bookings give their redemption back.
    const [{ total, mine }] = (await this.dataSource.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE customer_id = $2)::int AS mine
         FROM bookings WHERE coupon_code = $1 AND status <> 'CANCELLED'`,
      [code, customerId],
    )) as Array<{ total: number; mine: number }>;
    if (coupon.usageLimit != null && total >= coupon.usageLimit) {
      throw new BadRequestException(`Offer ${code} has been fully redeemed`);
    }
    if (mine >= coupon.perCustomerLimit) {
      throw new BadRequestException(`You've already used ${code}`);
    }

    let discount =
      coupon.discountType === 'PERCENT' ? (subtotal * Number(coupon.value)) / 100 : Number(coupon.value);
    if (coupon.maxDiscount != null) discount = Math.min(discount, Number(coupon.maxDiscount));
    discount = round2(Math.min(discount, subtotal));
    return { code, description: coupon.description, discount };
  }
}
