import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { randomInt } from 'crypto';
import { User } from '../users/user.entity';
import { WalletTransaction } from './entities/wallet-transaction.entity';

// Both the new customer and the friend who referred them get this much
// wallet credit once the new customer's first booking is paid.
export const REFERRAL_REWARD = 100;

const round2 = (n: number) => Math.round(n * 100) / 100;

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(WalletTransaction)
    private readonly txRepo: Repository<WalletTransaction>,
    private readonly dataSource: DataSource,
  ) {}

  private async ensureReferralCode(user: User): Promise<string> {
    if (user.referralCode) return user.referralCode;
    const prefix = (user.fullName.replace(/[^A-Za-z]/g, '').slice(0, 4) || 'AROG').toUpperCase();
    for (let i = 0; i < 8; i++) {
      const code = `${prefix}${randomInt(1000, 10000)}`;
      const taken = await this.usersRepo.exists({ where: { referralCode: code } });
      if (taken) continue;
      await this.usersRepo.update(user.id, { referralCode: code });
      return code;
    }
    throw new BadRequestException('Could not create a referral code — please try again');
  }

  async getSummary(userId: string) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const referralCode = await this.ensureReferralCode(user);
    const [transactions, referredCount, canApplyReferral] = await Promise.all([
      this.txRepo.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 30 }),
      this.usersRepo.count({ where: { referredById: userId } }),
      this.canApplyReferral(user),
    ]);
    return {
      balance: Number(user.walletBalance),
      referralCode,
      referralReward: REFERRAL_REWARD,
      referredCount,
      referredBy: Boolean(user.referredById),
      canApplyReferral,
      transactions: transactions.map((t) => ({ ...t, amount: Number(t.amount) })),
    };
  }

  // A referral code can only be attached before the customer's first paid
  // booking, and only once.
  private async canApplyReferral(user: User): Promise<boolean> {
    if (user.referredById) return false;
    const [{ paid }] = (await this.dataSource.query(
      `SELECT COUNT(*)::int AS paid FROM bookings WHERE customer_id = $1 AND payment_status = 'PAID'`,
      [user.id],
    )) as Array<{ paid: number }>;
    return paid === 0;
  }

  async applyReferral(userId: string, rawCode: string): Promise<void> {
    const code = rawCode.trim().toUpperCase();
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (!(await this.canApplyReferral(user))) {
      throw new BadRequestException('A referral code can only be added once, before your first paid booking');
    }
    const referrer = await this.usersRepo.findOne({ where: { referralCode: code } });
    if (!referrer) throw new BadRequestException(`"${code}" isn't a valid referral code`);
    if (referrer.id === userId) throw new BadRequestException("You can't use your own referral code");
    await this.usersRepo.update(userId, { referredById: referrer.id });
  }

  // Spends wallet credit inside the caller's transaction. The guarded
  // UPDATE makes an overdraft impossible even under concurrent bookings.
  async debit(manager: EntityManager, userId: string, amount: number, reason: string, bookingId: string) {
    if (amount <= 0) return;
    const result = await manager.query(
      `UPDATE users SET wallet_balance = wallet_balance - $1 WHERE id = $2 AND wallet_balance >= $1 RETURNING id`,
      [amount, userId],
    );
    if (!result.length) throw new BadRequestException('Not enough wallet balance');
    await manager.save(WalletTransaction, { userId, amount: -amount, reason, bookingId });
  }

  async credit(manager: EntityManager, userId: string, amount: number, reason: string, bookingId?: string) {
    if (amount <= 0) return;
    await manager.query(`UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id = $2`, [amount, userId]);
    await manager.save(WalletTransaction, { userId, amount, reason, bookingId: bookingId ?? null });
  }

  async balanceOf(userId: string): Promise<number> {
    const user = await this.usersRepo.findOne({ where: { id: userId }, select: ['id', 'walletBalance'] });
    return user ? Number(user.walletBalance) : 0;
  }

  async refundBooking(userId: string, amount: number, bookingId: string) {
    if (amount <= 0) return;
    await this.dataSource.transaction((m) =>
      this.credit(m, userId, round2(amount), 'Refund — booking cancelled', bookingId),
    );
  }

  // Called when a customer's booking becomes paid. The first time that
  // happens for a referred customer, both sides get their reward — once,
  // guarded by referral_rewarded_at under a row lock.
  async rewardReferralIfDue(customerId: string, bookingId: string): Promise<void> {
    try {
      await this.dataSource.transaction(async (m) => {
        const [row] = (await m.query(
          `SELECT referred_by_id, referral_rewarded_at, full_name FROM users WHERE id = $1 FOR UPDATE`,
          [customerId],
        )) as Array<{ referred_by_id: string | null; referral_rewarded_at: Date | null; full_name: string }>;
        if (!row?.referred_by_id || row.referral_rewarded_at) return;
        await m.query(`UPDATE users SET referral_rewarded_at = now() WHERE id = $1`, [customerId]);
        await this.credit(m, customerId, REFERRAL_REWARD, 'Welcome reward — joined with a referral', bookingId);
        await this.credit(m, row.referred_by_id, REFERRAL_REWARD, `Referral reward — ${row.full_name} booked a test`);
      });
    } catch (err) {
      // A reward must never fail the payment that triggered it.
      this.logger.error(`Referral reward failed for ${customerId}`, err instanceof Error ? err.stack : err);
    }
  }
}
