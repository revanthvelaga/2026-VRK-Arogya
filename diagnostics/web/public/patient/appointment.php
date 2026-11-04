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
    } elseif (($_POST['action'] ?? '') === 'share') {
        create_share($id, (int)$u['id'], (int)($_POST['days'] ?? 7));
        flash('Share link created. Copy it and send it to your doctor.');
    } elseif (($_POST['action'] ?? '') === 'revoke') {
        db()->prepare('UPDATE report_shares SET revoked_at=NOW() WHERE id=? AND appointment_id=? AND created_by=?')->execute([(int)$_POST['share_id'], $id, $u['id']]);
        flash('Link revoked.');
    }
    redirect('/patient/appointment.php?id=' . $id);
}

$items = db()->prepare('SELECT COALESCE(t.name, pk.name) AS name, i.price FROM appointment_items i LEFT JOIN tests t ON t.id=i.test_id LEFT JOIN packages pk ON pk.id=i.package_id WHERE i.appointment_id=?');
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
  <p><strong>Collection:</strong> <?= h(['HOME_VISIT' => 'Technician visits you', 'PICKUP_POINT' => 'Village pickup point', 'WALK_IN' => 'Walk-in at the centre'][$a['collection_mode']] ?? $a['collection_mode']) ?></p>
  <p><strong>Address:</strong> <?= nl2br(h($a['address'])) ?></p>
  <?php if ($a['tech_name']): ?><p><strong>Technician:</strong> <?= h($a['tech_name']) ?> (<?= h($a['tech_phone']) ?>)</p><?php endif; ?>
  <table><tr><th>Test</th><th>Price</th></tr>
  <?php foreach ($items->fetchAll() as $i): ?><tr><td><?= h($i['name']) ?></td><td>₹<?= number_format((float)$i['price'], 2) ?></td></tr><?php endforeach; ?>
  <?php if ((float)$a['wallet_used'] > 0): ?><tr><td>Paid from wallet</td><td>−₹<?= number_format((float)$a['wallet_used'], 2) ?></td></tr><?php endif; ?>
  <?php if ((float)$a['discount_amount'] > 0): ?><tr><td>Offer <?= h($a['coupon_code']) ?></td><td>−₹<?= number_format((float)$a['discount_amount'], 2) ?></td></tr><?php endif; ?>
  <tr><th>Total</th><th>₹<?= number_format((float)$a['total_amount'], 2) ?></th></tr></table>
  <p><strong>Payment:</strong> <?= h($a['payment_status']) ?>
    · <a href="/invoice.php?id=<?= $id ?>" target="_blank">Invoice</a>
    <?php if ($receipt): ?> · <a href="/receipt.php?id=<?= $id ?>" target="_blank">Receipt <?= h($receipt) ?></a><?php endif; ?></p>
</div>
<h3>Live status</h3>
<table><tr><th>Status</th><th>Time</th></tr>
<?php foreach ($log->fetchAll() as $l): ?><tr><td><?= h(STATUS_LABELS[$l['status']] ?? $l['status']) ?></td><td><?= h($l['changed_at']) ?></td></tr><?php endforeach; ?></table>
<?php $rv = db()->prepare('SELECT * FROM report_values WHERE appointment_id=? ORDER BY test_name'); $rv->execute([$id]); $values = $rv->fetchAll(); if ($values): ?>
<h3>Results</h3>
<table><tr><th>Test</th><th>Result</th><th>Normal range</th></tr>
<?php foreach ($values as $v): ?><tr><td><?= h($v['test_name']) ?></td><td><span class="badge s-<?= $v['is_abnormal'] ? 'CANCELLED' : 'REPORT_READY' ?>"><?= h(rtrim(rtrim($v['value'], '0'), '.')) ?> <?= h($v['unit']) ?></span></td><td><?= h($v['normal_low'] ?? '–') ?> – <?= h($v['normal_high'] ?? '–') ?></td></tr><?php endforeach; ?></table>
<?php endif; ?>
<h3>Reports</h3>
<?php foreach ($reports->fetchAll() as $r): ?>
  <p><a class="btn small" href="/report_download.php?id=<?= (int)$r['id'] ?>"><?= h($r['original_name']) ?></a> <small><?= h($r['uploaded_at']) ?></small></p>
<?php endforeach; if (!$reports->rowCount() && $a['status'] !== 'REPORT_READY'): ?><p>Report will appear here when ready.</p><?php endif; ?>
<?php if ($values || $a['status'] === 'REPORT_READY'):
  $sh = db()->prepare('SELECT * FROM report_shares WHERE appointment_id=? AND created_by=? AND revoked_at IS NULL AND expires_at > NOW() ORDER BY id DESC'); $sh->execute([$id, $u['id']]); ?>
<div class="card"><h3>Share with your doctor</h3><p class="page-sub">Anyone with the link can see these results until it expires. Your phone and address are not shown.</p>
  <form method="post" style="display:flex;gap:8px;flex-wrap:wrap"><?= csrf_field() ?><input type="hidden" name="action" value="share"><select name="days" style="width:auto"><option value="1">1 day</option><option value="7" selected>7 days</option><option value="30">30 days</option></select><button class="btn">Create link</button></form>
  <?php foreach ($sh->fetchAll() as $l): $url = base_url() . '/share.php?t=' . $l['token']; ?>
  <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;align-items:center"><input readonly value="<?= h($url) ?>" onclick="this.select()" style="flex:1;min-width:220px">
    <button type="button" class="btn small secondary" onclick="navigator.clipboard.writeText('<?= h($url) ?>')">Copy</button>
    <form method="post"><?= csrf_field() ?><input type="hidden" name="action" value="revoke"><input type="hidden" name="share_id" value="<?= (int)$l['id'] ?>"><button class="btn small danger">Revoke</button></form>
    <small>Expires <?= h(date('d M', strtotime($l['expires_at']))) ?> · <?= (int)$l['view_count'] ?> views</small></div>
  <?php endforeach; ?></div>
<?php endif; ?>
<?php if (in_array($a['status'], ['BOOKED', 'ASSIGNED'], true)): ?>
<form method="post" onsubmit="return confirm('Cancel this appointment?')"><?= csrf_field() ?><input type="hidden" name="action" value="cancel"><button class="btn danger">Cancel appointment</button></form>
<?php endif; ?>
<?php render_footer();
