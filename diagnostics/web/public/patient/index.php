<?php
require __DIR__ . '/../../includes/bootstrap.php';
$u = require_role('PATIENT');
$s = db()->prepare('SELECT a.*, (SELECT COUNT(*) FROM reports r WHERE r.appointment_id=a.id) AS report_count FROM appointments a WHERE patient_id=? ORDER BY scheduled_at DESC');
$s->execute([$u['id']]);
$appts = $s->fetchAll();
$n = db()->prepare('SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 5');
$n->execute([$u['id']]);
render_header('My Appointments', $u);
?>
<h1>My Appointments</h1>
<p><a class="btn" href="/patient/book.php">Book new appointment</a></p>
<table>
<tr><th>#</th><th>When</th><th>Status</th><th>Amount</th><th>Payment</th><th></th></tr>
<?php foreach ($appts as $a): ?>
<tr>
  <td><?= (int)$a['id'] ?></td>
  <td><?= h(date('d M Y H:i', strtotime($a['scheduled_at']))) ?></td>
  <td><span class="badge s-<?= h($a['status']) ?>"><?= h(STATUS_LABELS[$a['status']]) ?></span></td>
  <td>₹<?= number_format((float)$a['total_amount'], 2) ?></td>
  <td><?= h($a['payment_status']) ?></td>
  <td><a href="/patient/appointment.php?id=<?= (int)$a['id'] ?>">View</a></td>
</tr>
<?php endforeach; if (!$appts): ?><tr><td colspan="6">No appointments yet.</td></tr><?php endif; ?>
</table>
<h2>Notifications</h2>
<?php foreach ($n->fetchAll() as $row): ?>
<div class="card"><strong><?= h($row['title']) ?></strong><br><?= h($row['body']) ?><br><small><?= h($row['created_at']) ?></small></div>
<?php endforeach; ?>
<?php render_footer();
