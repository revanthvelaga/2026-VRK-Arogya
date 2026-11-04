<?php
require __DIR__ . '/../../includes/bootstrap.php';
$u = require_role('PATIENT');
$id = (int)($_GET['id'] ?? 0);
$s = db()->prepare('SELECT a.*, t.full_name AS tech_name, t.phone AS tech_phone FROM appointments a LEFT JOIN users t ON t.id=a.technician_id WHERE a.id=? AND a.patient_id=?');
$s->execute([$id, $u['id']]);
$a = $s->fetch();
if (!$a) { http_response_code(404); exit('Not found'); }

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    if (($_POST['action'] ?? '') === 'cancel' && in_array($a['status'], ['BOOKED', 'ASSIGNED'], true)) {
        set_status($id, 'CANCELLED', (int)$u['id']);
        flash('Appointment cancelled.');
    }
    redirect('/patient/appointment.php?id=' . $id);
}

$items = db()->prepare('SELECT t.name, i.price FROM appointment_items i JOIN tests t ON t.id=i.test_id WHERE i.appointment_id=?');
$items->execute([$id]);
$log = db()->prepare('SELECT status, changed_at FROM appointment_status_log WHERE appointment_id=? ORDER BY id');
$log->execute([$id]);
$reports = db()->prepare('SELECT * FROM reports WHERE appointment_id=? ORDER BY id DESC');
$reports->execute([$id]);
$pay = db()->prepare("SELECT receipt_no FROM payments WHERE appointment_id=? AND status='PAID' ORDER BY id DESC LIMIT 1");
$pay->execute([$id]);
$receipt = $pay->fetchColumn();

render_header('Appointment #' . $id, $u);
?>
<h1>Appointment #<?= $id ?> <span class="badge s-<?= h($a['status']) ?>"><?= h(STATUS_LABELS[$a['status']]) ?></span></h1>
<div class="card"><?= stepper($a['status']) ?></div>
<div class="card">
  <p><strong>When:</strong> <?= h(date('d M Y H:i', strtotime($a['scheduled_at']))) ?></p>
  <p><strong>Address:</strong> <?= nl2br(h($a['address'])) ?></p>
  <?php if ($a['tech_name']): ?><p><strong>Technician:</strong> <?= h($a['tech_name']) ?> (<?= h($a['tech_phone']) ?>)</p><?php endif; ?>
  <table><tr><th>Test</th><th>Price</th></tr>
  <?php foreach ($items->fetchAll() as $i): ?><tr><td><?= h($i['name']) ?></td><td>₹<?= number_format((float)$i['price'], 2) ?></td></tr><?php endforeach; ?>
  <tr><th>Total</th><th>₹<?= number_format((float)$a['total_amount'], 2) ?></th></tr></table>
  <p><strong>Payment:</strong> <?= h($a['payment_status']) ?>
    <?php if ($receipt): ?> · <a href="/receipt.php?id=<?= $id ?>" target="_blank">Receipt <?= h($receipt) ?></a><?php endif; ?></p>
</div>
<h3>Live status</h3>
<table><tr><th>Status</th><th>Time</th></tr>
<?php foreach ($log->fetchAll() as $l): ?><tr><td><?= h(STATUS_LABELS[$l['status']] ?? $l['status']) ?></td><td><?= h($l['changed_at']) ?></td></tr><?php endforeach; ?></table>
<h3>Reports</h3>
<?php foreach ($reports->fetchAll() as $r): ?>
  <p><a class="btn small" href="/report_download.php?id=<?= (int)$r['id'] ?>"><?= h($r['original_name']) ?></a> <small><?= h($r['uploaded_at']) ?></small></p>
<?php endforeach; if (!$reports->rowCount() && $a['status'] !== 'REPORT_READY'): ?><p>Report will appear here when ready.</p><?php endif; ?>
<?php if (in_array($a['status'], ['BOOKED', 'ASSIGNED'], true)): ?>
<form method="post" onsubmit="return confirm('Cancel this appointment?')"><?= csrf_field() ?><input type="hidden" name="action" value="cancel"><button class="btn danger">Cancel appointment</button></form>
<?php endif; ?>
<?php render_footer();
