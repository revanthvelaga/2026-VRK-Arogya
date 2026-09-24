import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// Every change to a wallet balance, positive (referral reward, refund) or
// negative (spent on a booking) — the balance on the user row is just the
// running total of these.
@Entity('wallet_transactions')
export class WalletTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  amount: number;

  @Column({ length: 150 })
  reason: string;

  @Column({ name: 'booking_id', type: 'varchar', nullable: true })
  bookingId?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
