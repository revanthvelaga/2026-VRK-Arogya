<?php
require __DIR__ . '/../../includes/bootstrap.php';
$u = require_role('ADMIN');
$pdo = db();
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $pdo->prepare('UPDATE staff_alerts SET read_at=NOW() WHERE user_id=? AND read_at IS NULL')->execute([$u['id']]);
    redirect('/admin/alerts.php');
}
$s = $pdo->prepare('SELECT * FROM staff_alerts WHERE user_id=? ORDER BY id DESC LIMIT 100'); $s->execute([$u['id']]);
$rows = $s->fetchAll();
$unread = count(array_filter($rows, fn($r) => !$r['read_at']));
render_header('Field Alerts', $u);
?>
<div class="page-header"><div><h1>Field alerts</h1><p class="page-sub">What technicians are doing: status updates and leave requests.</p></div>
<?php if ($unread): ?><form method="post"><?= csrf_field() ?><button class="btn secondary">Mark <?= $unread ?> as read</button></form><?php endif; ?></div>
<?php if (!$rows): echo '<div class="card">' . empty_state('clock', 'No field activity yet.') . '</div>'; else: foreach ($rows as $r): ?>
<div class="card" style="padding:12px 18px;<?= $r['read_at'] ? 'opacity:.7' : 'border-color:var(--accent-soft-strong)' ?>"><div class="job-head">
<span><?= !$r['read_at'] ? '<span class="badge s-ASSIGNED">New</span> ' : '' ?><?= h($r['message']) ?></span>
<small><?= h(date('d M, H:i', strtotime($r['created_at']))) ?><?= $r['link'] ? ' · <a href="' . h($r['link']) . '">Open</a>' : '' ?></small></div></div>
<?php endforeach; endif; ?>
<?php render_footer();
