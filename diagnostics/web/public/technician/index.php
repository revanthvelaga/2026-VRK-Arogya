<?php
require __DIR__ . '/../../includes/bootstrap.php';
$u = require_role('TECHNICIAN');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $id = (int)($_POST['id'] ?? 0);
    $new = $_POST['status'] ?? '';
    $own = db()->prepare('SELECT 1 FROM appointments WHERE id=? AND technician_id=?');
    $own->execute([$id, $u['id']]);
    // Technicians may only move their own jobs ASSIGNED -> ON_WAY -> SAMPLE_COLLECTED
    if ($own->fetchColumn() && in_array($new, ['ON_WAY', 'SAMPLE_COLLECTED'], true) && set_status($id, $new, (int)$u['id'])) {
        flash('Status updated.');
    } else {
        flash('That update is not allowed.');
    }
    redirect('/technician/');
}

$s = db()->prepare("SELECT a.*, p.full_name, p.phone FROM appointments a JOIN users p ON p.id=a.patient_id WHERE a.technician_id=? AND a.status IN ('ASSIGNED','ON_WAY','SAMPLE_COLLECTED') ORDER BY a.scheduled_at");
$s->execute([$u['id']]);
render_header('My Jobs', $u);
?>
<h1>Assigned Jobs</h1>
<?php foreach ($s->fetchAll() as $a): ?>
<div class="card">
  <strong>#<?= (int)$a['id'] ?> — <?= h($a['full_name']) ?></strong> <span class="badge"><?= h(STATUS_LABELS[$a['status']]) ?></span><br>
  <?= h(date('d M Y H:i', strtotime($a['scheduled_at']))) ?> · <a href="tel:<?= h($a['phone']) ?>"><?= h($a['phone']) ?></a><br>
  <?= nl2br(h($a['address'])) ?><br>
  <a href="https://www.google.com/maps/search/?api=1&query=<?= urlencode($a['address']) ?>" target="_blank" rel="noopener">Navigate</a>
  <?php $next = ['ASSIGNED' => 'ON_WAY', 'ON_WAY' => 'SAMPLE_COLLECTED'][$a['status']] ?? null; if ($next): ?>
  <form method="post" style="margin-top:8px"><?= csrf_field() ?><input type="hidden" name="id" value="<?= (int)$a['id'] ?>"><input type="hidden" name="status" value="<?= $next ?>">
    <button class="btn"><?= $next === 'ON_WAY' ? 'Mark On Way' : 'Mark Sample Collected' ?></button></form>
  <?php endif; ?>
</div>
<?php endforeach; ?>
<?php render_footer();
