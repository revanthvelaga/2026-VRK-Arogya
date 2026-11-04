<?php
require __DIR__ . '/../../includes/bootstrap.php';
$u = require_role('ADMIN');
$pdo = db();
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $v = trim($_POST['monthly_salary'] ?? '');
    if ($v !== '' && (!is_numeric($v) || (float)$v < 0)) flash('Enter a valid amount.');
    else {
        $pdo->prepare("UPDATE users SET monthly_salary=? WHERE id=? AND role='TECHNICIAN'")->execute([$v === '' ? null : (float)$v, (int)$_POST['id']]);
        flash('Salary updated.');
    }
    redirect('/admin/salary.php');
}
$month = date('Y-m');
$rows = $pdo->prepare("SELECT u.id, u.full_name, u.phone, u.monthly_salary, u.is_active,
    (SELECT COUNT(*) FROM appointment_status_log l WHERE l.changed_by=u.id AND l.status='SAMPLE_COLLECTED' AND DATE_FORMAT(l.changed_at,'%Y-%m')=?) AS visits,
    (SELECT COALESCE(SUM(DATEDIFF(LEAST(end_date, LAST_DAY(CURDATE())), GREATEST(start_date, DATE_FORMAT(CURDATE(),'%Y-%m-01'))) + 1),0) FROM leaves lv
       WHERE lv.user_id=u.id AND lv.status='APPROVED' AND lv.end_date >= DATE_FORMAT(CURDATE(),'%Y-%m-01') AND lv.start_date <= LAST_DAY(CURDATE())) AS leave_days
    FROM users u WHERE u.role='TECHNICIAN' ORDER BY u.full_name");
$rows->execute([$month]);
$staff = $rows->fetchAll();
$total = array_sum(array_map(fn($s) => (float)$s['monthly_salary'], $staff));
render_header('Salary', $u);
?>
<div class="page-header"><div><h1>Salary</h1><p class="page-sub">Monthly salary for each technician, with this month's visits and approved leave days.</p></div></div>
<div class="stat-grid"><div class="stat-tile"><div class="stat-icon"><?= nav_icon('wallet', 16) ?></div><div class="n"><?= h(money($total)) ?></div><div class="l">Monthly payroll</div></div>
<div class="stat-tile"><div class="stat-icon"><?= nav_icon('users', 16) ?></div><div class="n"><?= count($staff) ?></div><div class="l">Technicians</div></div>
<div class="stat-tile"><div class="stat-icon"><?= nav_icon('truck', 16) ?></div><div class="n"><?= array_sum(array_column($staff, 'visits')) ?></div><div class="l">Samples collected in <?= date('M') ?></div></div></div>
<?php if (!$staff): echo '<div class="card">' . empty_state('users', 'Add technicians first.') . '</div>'; else: ?>
<table><tr><th>Technician</th><th>Samples (<?= date('M') ?>)</th><th>Leave days (<?= date('M') ?>)</th><th>Monthly salary</th></tr>
<?php foreach ($staff as $s): $fid = 's' . (int)$s['id']; ?><tr><td><?= h($s['full_name']) ?> <?= $s['is_active'] ? '' : '<span class="badge s-CANCELLED">Inactive</span>' ?><br><small><?= h($s['phone']) ?></small></td>
<td><?= (int)$s['visits'] ?></td><td><?= (int)$s['leave_days'] ?></td>
<td><form id="<?= $fid ?>" method="post" style="display:flex;gap:6px"><?= csrf_field() ?><input type="hidden" name="id" value="<?= (int)$s['id'] ?>"><input name="monthly_salary" type="number" step="0.01" min="0" value="<?= h($s['monthly_salary']) ?>" placeholder="Set salary" style="width:140px"><button class="btn small">Save</button></form></td></tr><?php endforeach; ?></table><?php endif; ?>
<?php render_footer();
