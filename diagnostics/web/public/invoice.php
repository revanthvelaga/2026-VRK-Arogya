<?php
// Printable invoice for an appointment (patient who owns it, or admin).
require __DIR__ . '/../includes/bootstrap.php';
$u = current_user();
if (!$u) redirect('/login.php');
$s = db()->prepare('SELECT a.*, p.full_name, p.phone, p.email, m.full_name AS member_name FROM appointments a JOIN users p ON p.id=a.patient_id LEFT JOIN family_members m ON m.id=a.member_id WHERE a.id=?');
$s->execute([(int)($_GET['id'] ?? 0)]);
$a = $s->fetch();
if (!$a || ($u['role'] !== 'ADMIN' && (int)$a['patient_id'] !== (int)$u['id'])) { http_response_code(404); exit('Not found'); }
$i = db()->prepare('SELECT COALESCE(t.name, pk.name) AS name, i.price FROM appointment_items i LEFT JOIN tests t ON t.id=i.test_id LEFT JOIN packages pk ON pk.id=i.package_id WHERE i.appointment_id=?');
$i->execute([$a['id']]);
$subtotal = $a['subtotal'] !== null ? (float)$a['subtotal'] : (float)$a['total_amount'];
?><!doctype html><html><head><meta charset="utf-8"><title>Invoice #<?= (int)$a['id'] ?></title>
<style>body{font-family:system-ui,sans-serif;max-width:680px;margin:30px auto;color:#10182c}table{width:100%;border-collapse:collapse;margin:16px 0}td,th{border-bottom:1px solid #e6e9f2;padding:8px;text-align:left}td.r,th.r{text-align:right}.big{font-size:20px;font-weight:800}@media print{button{display:none}}</style></head><body>
<h2><?= h(APP_NAME) ?> — Invoice</h2>
<p>Invoice for appointment <b>#<?= (int)$a['id'] ?></b><br>Date: <?= h(date('d M Y', strtotime($a['created_at']))) ?><br>Patient: <?= h($a['member_name'] ?: $a['full_name']) ?><?= $a['member_name'] ? ' (booked by ' . h($a['full_name']) . ')' : '' ?> · <?= h($a['phone']) ?><br>
Collection: <?= h(['HOME_VISIT' => 'Home visit', 'PICKUP_POINT' => 'Village pickup point', 'WALK_IN' => 'Walk-in'][$a['collection_mode']] ?? '') ?> · <?= h($a['address']) ?></p>
<table><tr><th>Item</th><th class="r">Amount</th></tr>
<?php foreach ($i->fetchAll() as $it): ?><tr><td><?= h($it['name']) ?></td><td class="r">₹<?= number_format((float)$it['price'], 2) ?></td></tr><?php endforeach; ?>
<tr><td>Subtotal</td><td class="r">₹<?= number_format($subtotal, 2) ?></td></tr>
<?php if ((float)$a['discount_amount'] > 0): ?><tr><td>Offer <?= h($a['coupon_code']) ?></td><td class="r">−₹<?= number_format((float)$a['discount_amount'], 2) ?></td></tr><?php endif; ?>
<?php if ((float)$a['wallet_used'] > 0): ?><tr><td>Paid from wallet</td><td class="r">−₹<?= number_format((float)$a['wallet_used'], 2) ?></td></tr><?php endif; ?>
<tr><td class="big">Amount payable</td><td class="r big">₹<?= number_format((float)$a['total_amount'], 2) ?></td></tr></table>
<p>Payment status: <b><?= h($a['payment_status']) ?></b></p>
<p><button onclick="window.print()">Print</button></p></body></html>
