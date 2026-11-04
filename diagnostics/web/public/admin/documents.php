<?php
require __DIR__ . '/../../includes/bootstrap.php';
$u = require_role('ADMIN');
$pdo = db();
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $pdo->prepare("UPDATE documents SET status='REVIEWED', admin_note=? WHERE id=?")->execute([substr(trim($_POST['admin_note'] ?? ''), 0, 500) ?: null, (int)$_POST['id']]);
    $o = $pdo->prepare('SELECT user_id FROM documents WHERE id=?'); $o->execute([(int)$_POST['id']]);
    if ($uid = $o->fetchColumn()) notify((int)$uid, 'Prescription reviewed', trim($_POST['admin_note'] ?? '') ?: 'Our team has reviewed your document.');
    flash('Marked as reviewed.');
    redirect('/admin/documents.php');
}
$rows = $pdo->query("SELECT d.*, p.full_name AS owner, p.phone, m.full_name AS member_name FROM documents d JOIN users p ON p.id=d.user_id LEFT JOIN family_members m ON m.id=d.member_id ORDER BY d.status='REVIEWED', d.id DESC LIMIT 200")->fetchAll();
render_header('Prescriptions', $u);
?>
<div class="page-header"><div><h1>Prescriptions &amp; documents</h1><p class="page-sub">Review uploads and tell patients which tests to book.</p></div></div>
<?php if (!$rows): echo '<div class="card">' . empty_state('file', 'No uploads yet.') . '</div>'; else: ?>
<table><tr><th>Patient</th><th>File</th><th>Status</th><th>Reply</th></tr>
<?php foreach ($rows as $d): ?><tr><td><?= h($d['owner']) ?><br><small><?= h($d['phone']) ?><?= $d['member_name'] ? ' · for ' . h($d['member_name']) : '' ?></small></td>
<td><a href="/file.php?id=<?= (int)$d['id'] ?>" target="_blank"><?= h($d['original_name']) ?></a><br><small><?= h($d['kind']) ?> · <?= h(date('d M, H:i', strtotime($d['created_at']))) ?><?= $d['note'] ? ' · ' . h($d['note']) : '' ?></small></td>
<td><span class="badge s-<?= $d['status'] === 'REVIEWED' ? 'REPORT_READY' : 'BOOKED' ?>"><?= h(ucfirst(strtolower($d['status']))) ?></span></td>
<td><form method="post" style="display:flex;gap:6px"><?= csrf_field() ?><input type="hidden" name="id" value="<?= (int)$d['id'] ?>"><input name="admin_note" placeholder="Suggested tests / note" value="<?= h($d['admin_note']) ?>"><button class="btn small">Save</button></form></td></tr><?php endforeach; ?></table><?php endif; ?>
<?php render_footer();
