<?php
require __DIR__ . '/../../includes/bootstrap.php';
$u = require_role('ADMIN');
$pdo = db();
$counts = $pdo->query('SELECT status, COUNT(*) c FROM appointments GROUP BY status')->fetchAll(PDO::FETCH_KEY_PAIR);
$today = $pdo->query("SELECT COUNT(*) c, COALESCE(SUM(total_amount),0) s FROM appointments WHERE DATE(created_at)=CURDATE() AND status<>'CANCELLED'")->fetch();
render_header('Dashboard', $u);
?>
<h1>Admin Dashboard</h1>
<div class="grid">
  <div class="card"><div class="stat"><?= (int)$today['c'] ?></div>Orders today (₹<?= number_format((float)$today['s'], 2) ?>)</div>
  <?php foreach (STATUS_LABELS as $k => $label): ?>
  <div class="card"><div class="stat"><?= (int)($counts[$k] ?? 0) ?></div><?= h($label) ?></div>
  <?php endforeach; ?>
</div>
<p><a class="btn" href="/admin/appointments.php">Manage appointments</a></p>
<?php render_footer();
