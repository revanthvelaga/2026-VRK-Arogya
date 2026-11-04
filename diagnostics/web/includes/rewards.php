<?php
declare(strict_types=1);
// Wallet and referral logic ported from Arogya's WalletService.

const REFERRAL_REWARD = 100;   // both sides get this once the referred user's first booking is paid

function wallet_balance(int $userId): float {
    $s = db()->prepare('SELECT wallet_balance FROM users WHERE id=?');
    $s->execute([$userId]);
    return (float)$s->fetchColumn();
}

function wallet_credit(int $userId, float $amount, string $reason, ?int $apptId = null): void {
    if ($amount <= 0) return;
    $pdo = db();
    $pdo->prepare('UPDATE users SET wallet_balance = wallet_balance + ? WHERE id=?')->execute([$amount, $userId]);
    $pdo->prepare('INSERT INTO wallet_transactions (user_id,amount,reason,appointment_id) VALUES (?,?,?,?)')->execute([$userId, $amount, $reason, $apptId]);
}

/** Guarded spend: the WHERE clause makes an overdraft impossible, even with concurrent bookings. */
function wallet_debit(int $userId, float $amount, string $reason, ?int $apptId = null): void {
    if ($amount <= 0) return;
    $pdo = db();
    $u = $pdo->prepare('UPDATE users SET wallet_balance = wallet_balance - ? WHERE id=? AND wallet_balance >= ?');
    $u->execute([$amount, $userId, $amount]);
    if ($u->rowCount() === 0) throw new InvalidArgumentException('Not enough wallet balance.');
    $pdo->prepare('INSERT INTO wallet_transactions (user_id,amount,reason,appointment_id) VALUES (?,?,?,?)')->execute([$userId, -$amount, $reason, $apptId]);
}

function ensure_referral_code(int $userId): string {
    $pdo = db();
    $s = $pdo->prepare('SELECT referral_code, full_name FROM users WHERE id=?');
    $s->execute([$userId]);
    $u = $s->fetch();
    if (!empty($u['referral_code'])) return $u['referral_code'];
    $prefix = strtoupper(substr(preg_replace('/[^A-Za-z]/', '', (string)$u['full_name']), 0, 4)) ?: 'DIAG';
    for ($i = 0; $i < 8; $i++) {
        $code = $prefix . random_int(1000, 9999);
        try {
            $pdo->prepare('UPDATE users SET referral_code=? WHERE id=? AND referral_code IS NULL')->execute([$code, $userId]);
            $s->execute([$userId]);
            $cur = $s->fetch();
            if (!empty($cur['referral_code'])) return $cur['referral_code'];
        } catch (PDOException $e) { /* code taken, retry */ }
    }
    throw new RuntimeException('Could not create a referral code.');
}

/** A referral can only be attached once, before the user's first paid booking. */
function can_apply_referral(int $userId): bool {
    $pdo = db();
    $s = $pdo->prepare('SELECT referred_by_id FROM users WHERE id=?'); $s->execute([$userId]);
    if ($s->fetchColumn()) return false;
    $p = $pdo->prepare("SELECT COUNT(*) FROM appointments WHERE patient_id=? AND payment_status='PAID'");
    $p->execute([$userId]);
    return (int)$p->fetchColumn() === 0;
}

function apply_referral(int $userId, string $rawCode): void {
    $code = strtoupper(trim($rawCode));
    if (!can_apply_referral($userId)) throw new InvalidArgumentException('A referral code can only be added once, before your first paid booking.');
    $pdo = db();
    $s = $pdo->prepare('SELECT id FROM users WHERE referral_code=?'); $s->execute([$code]);
    $ref = $s->fetchColumn();
    if (!$ref) throw new InvalidArgumentException("\"$code\" isn't a valid referral code.");
    if ((int)$ref === $userId) throw new InvalidArgumentException("You can't use your own referral code.");
    $pdo->prepare('UPDATE users SET referred_by_id=? WHERE id=?')->execute([$ref, $userId]);
}

/** Called when a booking becomes paid; rewards both sides exactly once. A reward must never fail the payment. */
function reward_referral_if_due(int $customerId, int $apptId): void {
    $pdo = db();
    try {
        $pdo->beginTransaction();
        $s = $pdo->prepare('SELECT referred_by_id, referral_rewarded_at, full_name FROM users WHERE id=? FOR UPDATE');
        $s->execute([$customerId]);
        $row = $s->fetch();
        if (!$row || !$row['referred_by_id'] || $row['referral_rewarded_at']) { $pdo->commit(); return; }
        $pdo->prepare('UPDATE users SET referral_rewarded_at=NOW() WHERE id=?')->execute([$customerId]);
        wallet_credit($customerId, REFERRAL_REWARD, 'Welcome reward — joined with a referral', $apptId);
        wallet_credit((int)$row['referred_by_id'], REFERRAL_REWARD, 'Referral reward — ' . $row['full_name'] . ' booked a test');
        $pdo->commit();
        notify($customerId, 'Welcome reward', '₹' . REFERRAL_REWARD . ' added to your wallet.');
        notify((int)$row['referred_by_id'], 'Referral reward', $row['full_name'] . ' booked a test. ₹' . REFERRAL_REWARD . ' added to your wallet.');
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        error_log('Referral reward failed: ' . $e->getMessage());
    }
}
