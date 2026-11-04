<?php
require __DIR__ . '/../../includes/bootstrap.php';
$u = require_role('PATIENT');
$pdo = db();
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    try { apply_referral((int)$u['id'], (string)($_POST['code'] ?? '')); flash('Referral code added. You both get ₹' . REFERRAL_REWARD . ' after your first paid booking.'); }
    catch (InvalidArgumentException $e) { flash($e->getMessage()); }
    redirect('/patient/wallet.php');
}
$code = ensure_referral_code((int)$u['id']);
$balance = wallet_balance((int)$u['id']);
$tx = $pdo->prepare('SELECT * FROM wallet_transactions WHERE user_id=? ORDER BY id DESC LIMIT 30'); $tx->execute([$u['id']]);
$cnt = $pdo->prepare('SELECT COUNT(*) FROM users WHERE referred_by_id=?'); $cnt->execute([$u['id']]);
render_header('Wallet & Refer', $u);
?>
<div class="page-header"><div><h1>Wallet &amp; refer</h1><p class="page-sub">Use your credit on your next booking.</p></div></div>
<div class="hero-card"><div class="hero-eyebrow">Wallet balance</div><div class="hero-figure"><?= h(money($balance)) ?></div>
  <div class="hero-meta"><span class="hero-chip">Your referral code: <b><?= h($code) ?></b></span><span class="hero-chip hero-chip-ghost"><?= (int)$cnt->fetchColumn() ?> friends joined</span></div></div>
<div class="card"><h3>Refer a friend</h3><p>Share your code. When your friend's first booking is paid, you each get <b>₹<?= REFERRAL_REWARD ?></b> in your wallet.</p>
  <?php if (can_apply_referral((int)$u['id'])): ?>
  <form method="post" style="display:flex;gap:8px"><?= csrf_field() ?><input name="code" placeholder="Have a friend's code?" style="text-transform:uppercase" required><button class="btn">Apply</button></form><?php endif; ?></div>
<h2>History</h2>
<?php $rows = $tx->fetchAll(); if (!$rows): echo '<div class="card">' . empty_state('wallet', 'No wallet activity yet.') . '</div>'; else: ?>
<table><tr><th>Date</th><th>Details</th><th>Amount</th></tr>
<?php foreach ($rows as $r): ?><tr><td><?= h(date('d M Y, H:i', strtotime($r['created_at']))) ?></td><td><?= h($r['reason']) ?></td>
<td style="color:<?= $r['amount'] >= 0 ? 'var(--accent-ink)' : 'var(--red)' ?>;font-weight:700"><?= $r['amount'] >= 0 ? '+' : '−' ?>₹<?= number_format(abs((float)$r['amount']), 2) ?></td></tr><?php endforeach; ?></table><?php endif; ?>
<?php render_footer();
