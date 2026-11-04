<?php
require __DIR__ . '/../includes/bootstrap.php';
$u = current_user();
if (!$u) redirect('/login.php');
$s = db()->prepare("SELECT p.*, a.patient_id, a.scheduled_at, u.full_name, u.phone FROM payments p JOIN appointments a ON a.id=p.appointment_id JOIN users u ON u.id=a.patient_id WHERE p.appointment_id=? AND p.status='PAID' ORDER BY p.id DESC LIMIT 1");
$s->execute([(int)($_GET['id'] ?? 0)]);
$p = $s->fetch();
if (!$p || ($u['role'] !== 'ADMIN' && (int)$p['patient_id'] !== (int)$u['id'])) { http_response_code(404); exit('Not found'); }
$items = db()->prepare('SELECT t.name, i.price FROM appointment_items i JOIN tests t ON t.id=i.test_id WHERE i.appointment_id=?');
$items->execute([$p['appointment_id']]);
?><!doctype html><html><head><meta charset="utf-8"><title>Receipt <?= h($p['receipt_no']) ?></title>
<style>body{font-family:sans-serif;max-width:600px;margin:30px auto}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #ccc;padding:6px;text-align:left}@media print{button{display:none}}</style></head><body>
<h2><?= h(APP_NAME) ?> — Payment Receipt</h2>
<p>Receipt No: <strong><?= h($p['receipt_no']) ?></strong><br>Date: <?= h($p['paid_at']) ?><br>Patient: <?= h($p['full_name']) ?> (<?= h($p['phone']) ?>)<br>Appointment: #<?= (int)$p['appointment_id'] ?><br>Method: <?= h($p['method']) ?></p>
<table><tr><th>Test</th><th>Amount</th></tr>
<?php foreach ($items->fetchAll() as $i): ?><tr><td><?= h($i['name']) ?></td><td>₹<?= number_format((float)$i['price'], 2) ?></td></tr><?php endforeach; ?>
<tr><th>Total paid</th><th>₹<?= number_format((float)$p['amount'], 2) ?></th></tr></table>
<p><button onclick="window.print()">Print</button></p></body></html>
