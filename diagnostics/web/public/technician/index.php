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
$jobs = $s->fetchAll();
render_header('My Jobs', $u);
?>
<div class="page-header"><div><h1><?= h(greeting()) ?>, <?= h(explode(' ', $u['full_name'])[0]) ?></h1>
  <p class="page-sub"><?= count($jobs) ?> job<?= count($jobs) === 1 ? '' : 's' ?> assigned to you.</p></div></div>

<?php if (!$jobs): echo '<div class="card">' . empty_state('truck', 'No assigned jobs right now. New jobs appear here when the admin assigns them.') . '</div>'; endif; ?>
<?php foreach ($jobs as $a): ?>
<div class="card job-card">
  <div class="job-head"><strong style="font-family:Sora,sans-serif">#<?= (int)$a['id'] ?> — <?= h($a['full_name']) ?></strong>
    <span class="badge s-<?= h($a['status']) ?>"><?= h(STATUS_LABELS[$a['status']]) ?></span></div>
  <div class="job-meta">
    <span><?= h(date('D, d M · H:i', strtotime($a['scheduled_at']))) ?></span>
    <span><?= nl2br(h($a['address'])) ?></span>
  </div>
  <?= stepper($a['status']) ?>
  <div style="display:flex;gap:8px;flex-wrap:wrap">
    <a class="btn small secondary" href="tel:<?= h($a['phone']) ?>">Call <?= h($a['phone']) ?></a>
    <a class="btn small secondary" href="https://www.google.com/maps/search/?api=1&query=<?= urlencode($a['address']) ?>" target="_blank" rel="noopener">Navigate</a>
    <?php $next = ['ASSIGNED' => 'ON_WAY', 'ON_WAY' => 'SAMPLE_COLLECTED'][$a['status']] ?? null; if ($next): ?>
    <form method="post"><?= csrf_field() ?><input type="hidden" name="id" value="<?= (int)$a['id'] ?>"><input type="hidden" name="status" value="<?= $next ?>">
      <button class="btn small"><?= $next === 'ON_WAY' ? 'Mark On Way' : 'Mark Sample Collected' ?></button></form>
    <?php endif; ?>
  </div>
</div>
<?php endforeach; ?>
<?php render_footer();
