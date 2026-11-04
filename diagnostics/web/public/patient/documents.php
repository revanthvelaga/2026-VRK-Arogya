<?php
require __DIR__ . '/../../includes/bootstrap.php';
$u = require_role('PATIENT');
$pdo = db();
const DOC_DIR_ENV = 'DOC_DIR';
function doc_dir(): string { return getenv('DOC_DIR') ?: dirname(UPLOAD_DIR) . '/documents'; }

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    if (($_POST['action'] ?? '') === 'upload') {
        $f = $_FILES['file'] ?? null;
        $ok = $f && $f['error'] === UPLOAD_ERR_OK && $f['size'] > 0 && $f['size'] <= 8 * 1024 * 1024;
        $mime = $ok ? (new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']) : '';     // trust content, not the file name
        $ext = ['application/pdf' => 'pdf', 'image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'][$mime] ?? null;
        if (!$ext) { flash('Upload a PDF, JPG, PNG or WebP file up to 8 MB.'); redirect('/patient/documents.php'); }
        $kind = in_array($_POST['kind'] ?? '', ['PRESCRIPTION', 'ID', 'REPORT', 'OTHER'], true) ? $_POST['kind'] : 'PRESCRIPTION';
        $member = null;
        if (!empty($_POST['member_id'])) { $m = $pdo->prepare('SELECT id FROM family_members WHERE id=? AND owner_id=?'); $m->execute([(int)$_POST['member_id'], $u['id']]); $member = $m->fetchColumn() ?: null; }
        if (!is_dir(doc_dir())) mkdir(doc_dir(), 0750, true);
        $name = bin2hex(random_bytes(16)) . '.' . $ext;
        move_uploaded_file($f['tmp_name'], doc_dir() . '/' . $name);
        $pdo->prepare('INSERT INTO documents (user_id,member_id,kind,file_name,original_name,mime,note) VALUES (?,?,?,?,?,?,?)')
            ->execute([$u['id'], $member, $kind, $name, substr(basename($f['name']), 0, 200), $mime, substr(trim($_POST['note'] ?? ''), 0, 250) ?: null]);
        flash($kind === 'PRESCRIPTION' ? 'Prescription uploaded. Our team will suggest the right tests.' : 'Document uploaded.');
    } elseif (($_POST['action'] ?? '') === 'delete') {
        $d = $pdo->prepare('SELECT file_name FROM documents WHERE id=? AND user_id=?'); $d->execute([(int)$_POST['id'], $u['id']]);
        if ($fn = $d->fetchColumn()) { @unlink(doc_dir() . '/' . basename($fn)); $pdo->prepare('DELETE FROM documents WHERE id=?')->execute([(int)$_POST['id']]); flash('Document deleted.'); }
    }
    redirect('/patient/documents.php');
}
$docs = $pdo->prepare('SELECT d.*, m.full_name AS member_name FROM documents d LEFT JOIN family_members m ON m.id=d.member_id WHERE d.user_id=? ORDER BY d.id DESC'); $docs->execute([$u['id']]);
$mem = $pdo->prepare('SELECT id, full_name FROM family_members WHERE owner_id=? AND is_active=1'); $mem->execute([$u['id']]);
$members = $mem->fetchAll();
render_header('Prescriptions', $u);
?>
<div class="page-header"><div><h1>Prescriptions &amp; documents</h1><p class="page-sub">Upload a doctor's prescription and our team will tell you which tests to book.</p></div></div>
<form method="post" enctype="multipart/form-data" class="card"><?= csrf_field() ?><input type="hidden" name="action" value="upload">
  <div class="grid"><label>Type <select name="kind"><option value="PRESCRIPTION">Prescription</option><option value="REPORT">Old report</option><option value="ID">ID proof</option><option value="OTHER">Other</option></select></label>
  <label>For <select name="member_id"><option value="">Myself</option><?php foreach ($members as $m): ?><option value="<?= (int)$m['id'] ?>"><?= h($m['full_name']) ?></option><?php endforeach; ?></select></label></div>
  <label>File (PDF, JPG, PNG — max 8 MB) <input type="file" name="file" accept="application/pdf,image/*" required></label>
  <label>Note (optional) <input name="note" maxlength="250"></label><button class="btn">Upload</button></form>
<?php $rows = $docs->fetchAll(); if (!$rows): echo '<div class="card">' . empty_state('file', 'Nothing uploaded yet.') . '</div>'; else: ?>
<table><tr><th>File</th><th>For</th><th>Status</th><th>Our note</th><th></th></tr>
<?php foreach ($rows as $d): ?><tr><td><a href="/file.php?id=<?= (int)$d['id'] ?>" target="_blank"><?= h($d['original_name']) ?></a><br><small><?= h(ucfirst(strtolower($d['kind']))) ?> · <?= h(date('d M Y', strtotime($d['created_at']))) ?></small></td>
<td><?= h($d['member_name'] ?: 'Myself') ?></td><td><span class="badge s-<?= $d['status'] === 'REVIEWED' ? 'REPORT_READY' : 'BOOKED' ?>"><?= h(ucfirst(strtolower($d['status']))) ?></span></td><td><?= h($d['admin_note']) ?></td>
<td><form method="post" onsubmit="return confirm('Delete this file?')"><?= csrf_field() ?><input type="hidden" name="action" value="delete"><input type="hidden" name="id" value="<?= (int)$d['id'] ?>"><button class="btn small danger">Delete</button></form></td></tr><?php endforeach; ?></table><?php endif; ?>
<?php render_footer();
