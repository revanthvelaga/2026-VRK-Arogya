<?php
require __DIR__ . '/../../includes/bootstrap.php';
$u = require_role('ADMIN');
$pdo = db();
$tid = (int)($_GET['id'] ?? 0);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $a = $_POST['action'] ?? '';
    $t = $pdo->prepare('SELECT raised_by, subject FROM tickets WHERE id=?'); $t->execute([$tid]);
    $row = $t->fetch();
    if ($row && $a === 'reply' && trim($_POST['body'] ?? '') !== '') {
        $pdo->prepare('INSERT INTO ticket_comments (ticket_id,author_id,body) VALUES (?,?,?)')->execute([$tid, $u['id'], trim($_POST['body'])]);
        $pdo->prepare("UPDATE tickets SET status = IF(status='OPEN','IN_PROGRESS',status) WHERE id=?")->execute([$tid]);
        notify((int)$row['raised_by'], 'Support replied', 'New reply on: ' . $row['subject']);
    } elseif ($row && $a === 'status' && in_array($_POST['status'] ?? '', ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'], true)) {
        $st = $_POST['status'];
        $pdo->prepare('UPDATE tickets SET status=?, resolved_by=?, resolved_at=? WHERE id=?')
            ->execute([$st, in_array($st, ['RESOLVED', 'CLOSED'], true) ? $u['id'] : null, in_array($st, ['RESOLVED', 'CLOSED'], true) ? date('Y-m-d H:i:s') : null, $tid]);
        notify((int)$row['raised_by'], 'Request ' . strtolower(str_replace('_', ' ', $st)), $row['subject']);
        flash('Status updated.');
    }
    redirect('/admin/support.php?id=' . $tid);
}

render_header('Support', $u);
if ($tid) {
    $s = $pdo->prepare('SELECT t.*, p.full_name, p.phone FROM tickets t JOIN users p ON p.id=t.raised_by WHERE t.id=?'); $s->execute([$tid]);
    $t = $s->fetch();
    if (!$t) { echo '<div class="card">' . empty_state('inbox', 'Request not found.') . '</div>'; render_footer(); exit; }
    $c = $pdo->prepare('SELECT c.*, a.full_name, a.role FROM ticket_comments c JOIN users a ON a.id=c.author_id WHERE c.ticket_id=? ORDER BY c.id'); $c->execute([$tid]);
    ?>
<p><a href="/admin/support.php">← All requests</a></p>
<div class="page-header"><div><h1><?= h($t['subject']) ?></h1><p class="page-sub"><?= h($t['full_name']) ?> · <?= h($t['phone']) ?><?= $t['appointment_id'] ? ' · <a href="/admin/appointments.php">Appointment #' . (int)$t['appointment_id'] . '</a>' : '' ?></p></div>
  <form method="post" style="display:flex;gap:6px"><?= csrf_field() ?><input type="hidden" name="action" value="status"><select name="status" style="width:auto"><?php foreach (['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as $x): ?><option value="<?= $x ?>" <?= $t['status'] === $x ? 'selected' : '' ?>><?= h(str_replace('_', ' ', $x)) ?></option><?php endforeach; ?></select><button class="btn small">Update</button></form></div>
<div class="card"><?= nl2br(h($t['description'])) ?></div>
<?php foreach ($c->fetchAll() as $m): ?><div class="card" style="padding:14px 18px;<?= $m['role'] === 'ADMIN' ? 'border-color:var(--accent-soft-strong);background:var(--accent-soft)' : '' ?>"><b><?= h($m['full_name']) ?></b> <small><?= h(date('d M, H:i', strtotime($m['created_at']))) ?></small><br><?= nl2br(h($m['body'])) ?></div><?php endforeach; ?>
<form method="post" class="card"><?= csrf_field() ?><input type="hidden" name="action" value="reply"><label>Reply <textarea name="body" rows="3" required></textarea></label><button class="btn">Send reply</button></form>
<?php } else {
    $rows = $pdo->query("SELECT t.*, p.full_name FROM tickets t JOIN users p ON p.id=t.raised_by ORDER BY FIELD(t.status,'OPEN','IN_PROGRESS','RESOLVED','CLOSED'), t.updated_at DESC LIMIT 200")->fetchAll();
    ?>
<div class="page-header"><div><h1>Support requests</h1><p class="page-sub">Questions and issues raised by patients.</p></div></div>
<?php if (!$rows): echo '<div class="card">' . empty_state('inbox', 'No requests yet.') . '</div>'; else: ?>
<table><tr><th>#</th><th>Patient</th><th>Subject</th><th>Status</th><th>Updated</th></tr>
<?php foreach ($rows as $r): ?><tr><td><?= (int)$r['id'] ?></td><td><?= h($r['full_name']) ?></td><td><a href="?id=<?= (int)$r['id'] ?>"><?= h($r['subject']) ?></a></td><td><span class="badge"><?= h(str_replace('_', ' ', $r['status'])) ?></span></td><td><?= h(date('d M, H:i', strtotime($r['updated_at']))) ?></td></tr><?php endforeach; ?></table><?php endif;
}
render_footer();
