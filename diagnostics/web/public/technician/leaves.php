<?php
require __DIR__ . '/../../includes/bootstrap.php';
$u = require_role('TECHNICIAN');
$pdo = db();
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    if (($_POST['action'] ?? '') === 'cancel') {
        $pdo->prepare("DELETE FROM leaves WHERE id=? AND user_id=? AND status='PENDING'")->execute([(int)$_POST['id'], $u['id']]);
        flash('Leave request withdrawn.');
    } else {
        $s = $_POST['start_date'] ?? ''; $e = $_POST['end_date'] ?? ''; $type = trim($_POST['leave_type'] ?? '');
        if (!strtotime($s) || !strtotime($e) || $e < $s || $type === '') flash('Choose valid dates (end on or after start) and a leave type.');
        elseif ($s < date('Y-m-d')) flash('Leave cannot start in the past.');
        else {
            $pdo->prepare('INSERT INTO leaves (user_id,start_date,end_date,leave_type,reason) VALUES (?,?,?,?,?)')->execute([$u['id'], $s, $e, mb_substr($type, 0, 50), trim($_POST['reason'] ?? '') ?: null]);
            staff_alert((int)$u['id'], 'LEAVE', $u['full_name'] . " requested $type leave from " . date('d M', strtotime($s)) . ' to ' . date('d M', strtotime($e)) . '.', '/admin/leaves.php');
            flash('Leave requested.');
        }
    }
    redirect('/technician/leaves.php');
}
$l = $pdo->prepare('SELECT * FROM leaves WHERE user_id=? ORDER BY start_date DESC'); $l->execute([$u['id']]);
$hol = $pdo->query('SELECT * FROM holidays WHERE holiday_date >= CURDATE() ORDER BY holiday_date LIMIT 8')->fetchAll();
render_header('My Leaves', $u);
?>
<div class="page-header"><div><h1>My leaves</h1><p class="page-sub">Request time off. The admin will approve or reject it.</p></div></div>
<form method="post" class="card"><?= csrf_field() ?><h3>Request leave</h3>
  <div class="grid"><label>From <input type="date" name="start_date" min="<?= date('Y-m-d') ?>" required></label><label>To <input type="date" name="end_date" min="<?= date('Y-m-d') ?>" required></label>
  <label>Type <select name="leave_type"><option>Casual</option><option>Sick</option><option>Emergency</option><option>Other</option></select></label></div>
  <label>Reason <input name="reason"></label><button class="btn">Request</button></form>
<?php $rows = $l->fetchAll(); if ($rows): ?><table><tr><th>Dates</th><th>Type</th><th>Status</th><th></th></tr>
<?php foreach ($rows as $r): ?><tr><td><?= h(date('d M', strtotime($r['start_date']))) ?> – <?= h(date('d M Y', strtotime($r['end_date']))) ?></td><td><?= h($r['leave_type']) ?></td>
<td><span class="badge s-<?= ['PENDING' => 'BOOKED', 'APPROVED' => 'REPORT_READY', 'REJECTED' => 'CANCELLED'][$r['status']] ?>"><?= h(ucfirst(strtolower($r['status']))) ?></span></td>
<td><?php if ($r['status'] === 'PENDING'): ?><form method="post"><?= csrf_field() ?><input type="hidden" name="action" value="cancel"><input type="hidden" name="id" value="<?= (int)$r['id'] ?>"><button class="btn small secondary">Withdraw</button></form><?php endif; ?></td></tr><?php endforeach; ?></table><?php endif; ?>
<?php if ($hol): ?><h2>Upcoming holidays</h2><div class="card"><?php foreach ($hol as $hh): ?><p style="margin:4px 0"><b><?= h(date('D, d M', strtotime($hh['holiday_date']))) ?></b> · <?= h($hh['name']) ?></p><?php endforeach; ?></div><?php endif; ?>
<?php render_footer();
