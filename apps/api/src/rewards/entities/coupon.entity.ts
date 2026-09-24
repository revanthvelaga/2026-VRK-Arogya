import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type DiscountType = 'PERCENT' | 'FLAT';

// An offer code customers type at checkout ("FIRST20", "SENIOR100").
@Entity('coupons')
export class Coupon {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 30, unique: true })
  code: string;

  @Column({ length: 200 })
  description: string;

  @Column({ name: 'discount_type', type: 'varchar', length: 10 })
  discountType: DiscountType;

  // Percent (1-100) or rupees, depending on discountType.
  @Column({ type: 'numeric', precision: 10, scale: 2 })
  value: number;

  // Caps a percentage discount (e.g. 20% up to ₹300).
  @Column({ name: 'max_discount', type: 'numeric', precision: 10, scale: 2, nullable: true })
  maxDiscount?: number | null;

  @Column({ name: 'min_order', type: 'numeric', precision: 10, scale: 2, default: 0 })
  minOrder: number;

  @Column({ name: 'valid_until', type: 'timestamptz', nullable: true })
  validUntil?: Date | null;

  // Total redemptions allowed across all customers; null = unlimited.
  @Column({ name: 'usage_limit', type: 'int', nullable: true })
  usageLimit?: number | null;

  @Column({ name: 'per_customer_limit', type: 'int', default: 1 })
  perCustomerLimit: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
