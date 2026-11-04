<?php
require __DIR__ . '/../../includes/bootstrap.php';
$u = require_role('PATIENT');
$s = db()->prepare('SELECT a.* FROM appointments a WHERE patient_id=? ORDER BY scheduled_at DESC');
$s->execute([$u['id']]);
$appts = $s->fetchAll();
$n = db()->prepare('SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 5');
$n->execute([$u['id']]);
$notes = $n->fetchAll();

// Next active appointment (soonest upcoming that isn't finished or cancelled)
$active = array_values(array_filter($appts, fn($a) => !in_array($a['status'], ['REPORT_READY', 'CANCELLED'], true)));
usort($active, fn($a, $b) => strtotime($a['scheduled_at']) <=> strtotime($b['scheduled_at']));
$next = $active[0] ?? null;

render_header('Home', $u);
?>
<div class="page-header"><div><h1><?= h(greeting()) ?>, <?= h(explode(' ', $u['full_name'])[0]) ?></h1><p class="page-sub">Book tests and track your sample and report in one place.</p></div>
  <a class="btn" href="/patient/book.php">Book a test</a></div>

<?php if ($next): ?>
<div class="hero-card"><div class="hero-eyebrow">Your next appointment</div>
  <div class="hero-figure" style="font-size:clamp(26px,5vw,36px)"><?= h(date('D, d M · H:i', strtotime($next['scheduled_at']))) ?></div>
  <div class="hero-label"><span class="badge s-<?= h($next['status']) ?>"><?= h(STATUS_LABELS[$next['status']]) ?></span> &nbsp; Appointment #<?= (int)$next['id'] ?> · <?= h(money($next['total_amount'])) ?></div>
  <div style="margin-top:18px"><?= stepper($next['status']) ?></div>
  <div class="hero-meta"><a class="hero-chip" href="/patient/appointment.php?id=<?= (int)$next['id'] ?>">View details →</a></div>
</div>
<?php endif; ?>

<h2>My appointments</h2>
<?php if (!$appts): echo '<div class="card">' . empty_state('cal', 'No appointments yet. Book your first test and it will appear here.') . '</div>'; else: ?>
<table><tr><th>#</th><th>When</th><th>Status</th><th>Amount</th><th>Payment</th><th></th></tr>
<?php foreach ($appts as $a): ?>
<tr>
  <td><?= (int)$a['id'] ?></td>
  <td><?= h(date('d M Y, H:i', strtotime($a['scheduled_at']))) ?></td>
  <td><span class="badge s-<?= h($a['status']) ?>"><?= h(STATUS_LABELS[$a['status']]) ?></span></td>
  <td><?= h(money($a['total_amount'])) ?></td>
  <td><?= h($a['payment_status']) ?></td>
  <td><a href="/patient/appointment.php?id=<?= (int)$a['id'] ?>">View</a></td>
</tr>
<?php endforeach; ?></table>
<?php endif; ?>

<?php if ($notes): ?><h2>Recent updates</h2>
<?php foreach ($notes as $row): ?>
<div class="card" style="padding:14px 18px"><strong><?= h($row['title']) ?></strong><br><?= h($row['body']) ?><br><small><?= h(date('d M, H:i', strtotime($row['created_at']))) ?></small></div>
<?php endforeach; endif; ?>
<?php render_footer();
