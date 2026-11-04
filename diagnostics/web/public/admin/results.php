<?php
// Enter lab result values for an appointment. Abnormal flags are computed on save.
require __DIR__ . '/../../includes/bootstrap.php';
$u = require_role('ADMIN');
$pdo = db();
$id = (int)($_GET['id'] ?? 0);
$a = $pdo->prepare('SELECT a.*, p.full_name FROM appointments a JOIN users p ON p.id=a.patient_id WHERE a.id=?');
$a->execute([$id]);
$appt = $a->fetch();
if (!$appt) { http_response_code(404); exit('Not found'); }

// Every test on the appointment, including the tests inside booked packages
$t = $pdo->prepare('SELECT DISTINCT t.* FROM tests t WHERE t.id IN (
    SELECT test_id FROM appointment_items WHERE appointment_id=? AND test_id IS NOT NULL
    UNION SELECT pt.test_id FROM appointment_items i JOIN package_tests pt ON pt.package_id=i.package_id WHERE i.appointment_id=?) ORDER BY t.name');
$t->execute([$id, $id]);
$tests = $t->fetchAll();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $saved = 0; $allowed = array_column($tests, 'id');
    foreach ((array)($_POST['value'] ?? []) as $testId => $v) {
        if (trim((string)$v) === '' || !in_array((int)$testId, array_map('intval', $allowed), true) || !is_numeric($v)) continue;
        save_report_value($id, (int)$testId, (float)$v);
        $saved++;
    }
    if ($saved) notify((int)$appt['patient_id'], 'Results updated', "Results for appointment #$id are available in your Insights.");
    flash("$saved result value(s) saved.");
    redirect('/admin/results.php?id=' . $id);
}
$v = $pdo->prepare('SELECT test_id, value, is_abnormal FROM report_values WHERE appointment_id=?'); $v->execute([$id]);
$vals = [];
foreach ($v->fetchAll() as $r) $vals[$r['test_id']] = $r;
render_header('Results #' . $id, $u);
?>
<p><a href="/admin/appointments.php">← Appointments</a></p>
<div class="page-header"><div><h1>Results for #<?= $id ?></h1><p class="page-sub"><?= h($appt['full_name']) ?> · <?= h(date('d M Y', strtotime($appt['scheduled_at']))) ?>. Values outside the normal range are flagged automatically.</p></div></div>
<form method="post"><?= csrf_field() ?>
<table><tr><th>Test</th><th>Normal range</th><th>Value</th><th></th></tr>
<?php foreach ($tests as $tt): $cur = $vals[$tt['id']] ?? null; ?>
<tr><td><?= h($tt['name']) ?></td>
<td><?= $tt['normal_range_low'] !== null || $tt['normal_range_high'] !== null ? h(($tt['normal_range_low'] ?? '–') . ' – ' . ($tt['normal_range_high'] ?? '–') . ' ' . $tt['normal_range_unit']) : '<small>Not numeric</small>' ?></td>
<td><input name="value[<?= (int)$tt['id'] ?>]" type="number" step="any" value="<?= h($cur['value'] ?? '') ?>" style="width:140px"></td>
<td><?php if ($cur): ?><span class="badge s-<?= $cur['is_abnormal'] ? 'CANCELLED' : 'REPORT_READY' ?>"><?= $cur['is_abnormal'] ? 'Out of range' : 'Normal' ?></span><?php endif; ?></td></tr>
<?php endforeach; ?></table>
<button class="btn">Save results</button></form>
<?php render_footer();
