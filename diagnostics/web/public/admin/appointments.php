<?php
require __DIR__ . '/../../includes/bootstrap.php';
$u = require_role('ADMIN');
$pdo = db();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $id = (int)($_POST['id'] ?? 0);
    $action = $_POST['action'] ?? '';
    if ($action === 'assign') {
        $tech = (int)($_POST['technician_id'] ?? 0);
        $chk = $pdo->prepare("SELECT 1 FROM users WHERE id=? AND role='TECHNICIAN' AND is_active=1");
        $chk->execute([$tech]);
        $st = $pdo->prepare('SELECT status FROM appointments WHERE id=?');
        $st->execute([$id]);
        $cur = $st->fetchColumn();
        if ($chk->fetchColumn() && in_array($cur, ['BOOKED', 'ASSIGNED'], true)) {
            $pdo->prepare('UPDATE appointments SET technician_id=? WHERE id=?')->execute([$tech, $id]);
            if ($cur === 'BOOKED') set_status($id, 'ASSIGNED', (int)$u['id']);
            notify($tech, 'New job assigned', "Appointment #$id has been assigned to you.");
            flash("Technician assigned to #$id.");
        } else flash('Cannot assign technician now.');
    } elseif ($action === 'status') {
        flash(set_status($id, $_POST['status'] ?? '', (int)$u['id']) ? 'Status updated.' : 'That transition is not allowed.');
    } elseif ($action === 'mark_paid') {
        $a = $pdo->prepare("SELECT total_amount FROM appointments WHERE id=? AND payment_status='PENDING'");
        $a->execute([$id]);
        if ($amt = $a->fetchColumn()) {
            $rc = record_payment($id, (float)$amt, 'CASH');
            $pid = $pdo->prepare('SELECT patient_id FROM appointments WHERE id=?'); $pid->execute([$id]);
            notify((int)$pid->fetchColumn(), 'Payment received', "Receipt $rc for appointment #$id.");
            flash("Marked paid. Receipt $rc.");
        }
    } elseif ($action === 'upload_report') {
        $f = $_FILES['report'] ?? null;
        $ok = $f && $f['error'] === UPLOAD_ERR_OK && $f['size'] > 0 && $f['size'] <= 10 * 1024 * 1024;
        // Verify real PDF content, not just the extension
        if ($ok && substr((string)file_get_contents($f['tmp_name'], false, null, 0, 5), 0, 5) === '%PDF-') {
            if (!is_dir(UPLOAD_DIR)) mkdir(UPLOAD_DIR, 0750, true);
            $name = bin2hex(random_bytes(16)) . '.pdf';
            move_uploaded_file($f['tmp_name'], rtrim(UPLOAD_DIR, '/') . '/' . $name);
            $pdo->prepare('INSERT INTO reports (appointment_id,file_name,original_name,uploaded_by) VALUES (?,?,?,?)')
                ->execute([$id, $name, substr(basename($f['name']), 0, 200), $u['id']]);
            $st = $pdo->prepare('SELECT status FROM appointments WHERE id=?'); $st->execute([$id]);
            if ($st->fetchColumn() === 'SAMPLE_COLLECTED') set_status($id, 'REPORT_READY', (int)$u['id']);
            else {
                $pid = $pdo->prepare('SELECT patient_id FROM appointments WHERE id=?'); $pid->execute([$id]);
                if ($p = $pid->fetchColumn()) notify((int)$p, 'Report uploaded', "A report for appointment #$id is available.");
            }
            flash('Report uploaded.');
        } else flash('Upload a valid PDF up to 10 MB.');
    }
    redirect('/admin/appointments.php' . (!empty($_GET['status']) ? '?status=' . urlencode($_GET['status']) : ''));
}

$filter = $_GET['status'] ?? '';
$sql = 'SELECT a.*, p.full_name, p.phone, t.full_name AS tech_name FROM appointments a JOIN users p ON p.id=a.patient_id LEFT JOIN users t ON t.id=a.technician_id';
$args = [];
if (isset(STATUS_LABELS[$filter])) { $sql .= ' WHERE a.status=?'; $args[] = $filter; }
$sql .= ' ORDER BY a.scheduled_at DESC LIMIT 200';
$q = $pdo->prepare($sql); $q->execute($args);
$rows = $q->fetchAll();
$techs = $pdo->query("SELECT id, full_name FROM users WHERE role='TECHNICIAN' AND is_active=1 ORDER BY full_name")->fetchAll();

render_header('Appointments', $u);
?>
<h1>Appointments</h1>
<p>Filter:
  <a href="?">All</a>
  <?php foreach (STATUS_LABELS as $k => $l): ?> | <a href="?status=<?= $k ?>"><?= h($l) ?></a><?php endforeach; ?></p>
<table>
<tr><th>#</th><th>Patient</th><th>When / Where</th><th>Status</th><th>Technician</th><th>Payment</th><th>Actions</th></tr>
<?php foreach ($rows as $a): $next = STATUS_FLOW[$a['status']]; ?>
<tr>
  <td><?= (int)$a['id'] ?></td>
  <td><?= h($a['full_name']) ?><br><small><?= h($a['phone']) ?></small></td>
  <td><?= h(date('d M H:i', strtotime($a['scheduled_at']))) ?><br><small><?= h(mb_strimwidth($a['address'], 0, 60, '…')) ?></small></td>
  <td><span class="badge s-<?= h($a['status']) ?>"><?= h(STATUS_LABELS[$a['status']]) ?></span></td>
  <td>
    <?php if (in_array($a['status'], ['BOOKED', 'ASSIGNED'], true)): ?>
    <form method="post"><?= csrf_field() ?><input type="hidden" name="action" value="assign"><input type="hidden" name="id" value="<?= (int)$a['id'] ?>">
      <select name="technician_id" required><option value="">Assign…</option>
      <?php foreach ($techs as $t): ?><option value="<?= (int)$t['id'] ?>" <?= (int)$a['technician_id'] === (int)$t['id'] ? 'selected' : '' ?>><?= h($t['full_name']) ?></option><?php endforeach; ?></select>
      <button class="btn small">Save</button></form>
    <?php else: echo h($a['tech_name'] ?? '—'); endif; ?>
  </td>
  <td>₹<?= number_format((float)$a['total_amount'], 2) ?><br><?= h($a['payment_status']) ?>
    <?php if ($a['payment_status'] === 'PENDING' && $a['status'] !== 'CANCELLED'): ?>
    <form method="post"><?= csrf_field() ?><input type="hidden" name="action" value="mark_paid"><input type="hidden" name="id" value="<?= (int)$a['id'] ?>"><button class="btn small secondary">Mark paid</button></form>
    <?php elseif ($a['payment_status'] === 'PAID'): ?><br><a href="/receipt.php?id=<?= (int)$a['id'] ?>" target="_blank">Receipt</a><?php endif; ?></td>
  <td>
    <?php foreach ($next as $n): if ($n === 'ASSIGNED') continue; ?>
    <form method="post" style="display:inline"><?= csrf_field() ?><input type="hidden" name="action" value="status"><input type="hidden" name="id" value="<?= (int)$a['id'] ?>"><input type="hidden" name="status" value="<?= $n ?>">
      <button class="btn small <?= $n === 'CANCELLED' ? 'danger' : '' ?>"><?= h(STATUS_LABELS[$n]) ?></button></form>
    <?php endforeach; ?>
    <?php if (in_array($a['status'], ['SAMPLE_COLLECTED', 'REPORT_READY'], true)): ?>
    <a class="btn small secondary" href="/admin/results.php?id=<?= (int)$a['id'] ?>">Enter results</a>
    <form method="post" enctype="multipart/form-data"><?= csrf_field() ?><input type="hidden" name="action" value="upload_report"><input type="hidden" name="id" value="<?= (int)$a['id'] ?>">
      <input type="file" name="report" accept="application/pdf" required><button class="btn small">Upload PDF</button></form>
    <?php endif; ?>
  </td>
</tr>
<?php endforeach; if (!$rows): ?><tr><td colspan="7">No appointments.</td></tr><?php endif; ?>
</table>
<?php render_footer();
