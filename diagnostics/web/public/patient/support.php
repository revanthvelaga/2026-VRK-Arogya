<?php
require __DIR__ . '/../../includes/bootstrap.php';
$u = require_role('PATIENT');
$pdo = db();
$tid = (int)($_GET['id'] ?? 0);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    if (($_POST['action'] ?? '') === 'create') {
        $subject = trim($_POST['subject'] ?? ''); $desc = trim($_POST['description'] ?? '');
        $appt = (int)($_POST['appointment_id'] ?? 0) ?: null;
        if ($appt) { $c = $pdo->prepare('SELECT 1 FROM appointments WHERE id=? AND patient_id=?'); $c->execute([$appt, $u['id']]); if (!$c->fetchColumn()) $appt = null; }
        if ($subject === '' || $desc === '') { flash('Subject and description are required.'); redirect('/patient/support.php'); }
        $pdo->prepare('INSERT INTO tickets (appointment_id,raised_by,subject,description) VALUES (?,?,?,?)')->execute([$appt, $u['id'], $subject, $desc]);
        flash('Your request was sent. We will reply here.');
        redirect('/patient/support.php?id=' . $pdo->lastInsertId());
    }
    if (($_POST['action'] ?? '') === 'comment') {
        $own = $pdo->prepare("SELECT status FROM tickets WHERE id=? AND raised_by=?"); $own->execute([$tid, $u['id']]);
        $st = $own->fetchColumn();
        $body = trim($_POST['body'] ?? '');
        if ($st && $st !== 'CLOSED' && $body !== '') {
            $pdo->prepare('INSERT INTO ticket_comments (ticket_id,author_id,body) VALUES (?,?,?)')->execute([$tid, $u['id'], $body]);
            if ($st === 'RESOLVED') $pdo->prepare("UPDATE tickets SET status='OPEN', resolved_at=NULL WHERE id=?")->execute([$tid]);  // reopen on reply
        }
    }
    redirect('/patient/support.php?id=' . $tid);
}

render_header('Support', $u);
if ($tid) {
    $s = $pdo->prepare('SELECT * FROM tickets WHERE id=? AND raised_by=?'); $s->execute([$tid, $u['id']]);
    $t = $s->fetch();
    if (!$t) { echo '<div class="card">' . empty_state('inbox', 'Request not found.') . '</div>'; render_footer(); exit; }
    $c = $pdo->prepare('SELECT c.*, a.full_name, a.role FROM ticket_comments c JOIN users a ON a.id=c.author_id WHERE c.ticket_id=? ORDER BY c.id'); $c->execute([$tid]);
    ?>
<p><a href="/patient/support.php">← All requests</a></p>
<div class="page-header"><div><h1><?= h($t['subject']) ?></h1><p class="page-sub">Request #<?= (int)$t['id'] ?><?= $t['appointment_id'] ? ' · Appointment #' . (int)$t['appointment_id'] : '' ?></p></div><span class="badge"><?= h(str_replace('_', ' ', $t['status'])) ?></span></div>
<div class="card"><?= nl2br(h($t['description'])) ?></div>
<?php foreach ($c->fetchAll() as $m): ?><div class="card" style="padding:14px 18px;<?= $m['role'] === 'ADMIN' ? 'border-color:var(--accent-soft-strong);background:var(--accent-soft)' : '' ?>"><b><?= $m['role'] === 'ADMIN' ? 'Support team' : 'You' ?></b> <small><?= h(date('d M, H:i', strtotime($m['created_at']))) ?></small><br><?= nl2br(h($m['body'])) ?></div><?php endforeach; ?>
<?php if ($t['status'] !== 'CLOSED'): ?><form method="post" class="card"><?= csrf_field() ?><input type="hidden" name="action" value="comment"><label>Reply <textarea name="body" rows="3" required></textarea></label><button class="btn">Send</button></form><?php endif;
} else {
    $l = $pdo->prepare('SELECT * FROM tickets WHERE raised_by=? ORDER BY updated_at DESC'); $l->execute([$u['id']]);
    $a = $pdo->prepare('SELECT id, scheduled_at FROM appointments WHERE patient_id=? ORDER BY id DESC LIMIT 20'); $a->execute([$u['id']]);
    ?>
<div class="page-header"><div><h1>Help &amp; support</h1><p class="page-sub">Ask about a booking, a report or a payment.</p></div></div>
<form method="post" class="card"><?= csrf_field() ?><input type="hidden" name="action" value="create"><h3>New request</h3>
  <label>About appointment (optional) <select name="appointment_id"><option value="">—</option><?php foreach ($a->fetchAll() as $x): ?><option value="<?= (int)$x['id'] ?>">#<?= (int)$x['id'] ?> · <?= h(date('d M Y', strtotime($x['scheduled_at']))) ?></option><?php endforeach; ?></select></label>
  <label>Subject <input name="subject" maxlength="150" required></label><label>Describe the problem <textarea name="description" rows="4" required></textarea></label><button class="btn">Send request</button></form>
<?php $rows = $l->fetchAll(); if (!$rows): echo '<div class="card">' . empty_state('inbox', 'No requests yet.') . '</div>'; else: ?>
<table><tr><th>#</th><th>Subject</th><th>Status</th><th>Updated</th></tr>
<?php foreach ($rows as $r): ?><tr><td><?= (int)$r['id'] ?></td><td><a href="?id=<?= (int)$r['id'] ?>"><?= h($r['subject']) ?></a></td><td><span class="badge"><?= h(str_replace('_', ' ', $r['status'])) ?></span></td><td><?= h(date('d M, H:i', strtotime($r['updated_at']))) ?></td></tr><?php endforeach; ?></table><?php endif;
}
render_footer();
