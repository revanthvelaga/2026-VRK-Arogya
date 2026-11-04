<?php
require __DIR__ . '/../../includes/bootstrap.php';
$u = require_role('ADMIN');
$pdo = db();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $a = $_POST['action'] ?? '';
    if ($a === 'toggle') {
        $pdo->prepare('UPDATE partner_labs SET is_active = 1 - is_active WHERE id=?')->execute([(int)$_POST['id']]);
        flash('Partner lab updated.');
    } elseif ($a === 'route') {
        // Route a test to a partner lab (or back in-house when no lab is chosen)
        $lab = (int)($_POST['partner_lab_id'] ?? 0) ?: null;
        $hours = max(1, (int)($_POST['turnaround_hours'] ?? 24));
        $pdo->prepare('UPDATE tests SET partner_lab_id=?, is_in_house=?, turnaround_hours=? WHERE id=?')->execute([$lab, $lab ? 0 : 1, $hours, (int)$_POST['test_id']]);
        flash('Test routing updated.');
    } else {
        $name = trim($_POST['name'] ?? '');
        if ($name === '') { flash('Lab name is required.'); }
        else {
            $pdo->prepare('INSERT INTO partner_labs (name,city,contact_phone,default_turnaround_hours) VALUES (?,?,?,?)')
                ->execute([$name, trim($_POST['city'] ?? '') ?: null, trim($_POST['contact_phone'] ?? '') ?: null, max(1, (int)($_POST['default_turnaround_hours'] ?? 24))]);
            flash('Partner lab added.');
        }
    }
    redirect('/admin/partner_labs.php');
}
$labs = $pdo->query('SELECT * FROM partner_labs ORDER BY name')->fetchAll();
$tests = $pdo->query('SELECT t.*, l.name AS lab_name FROM tests t LEFT JOIN partner_labs l ON l.id=t.partner_lab_id WHERE t.is_active=1 ORDER BY t.name')->fetchAll();
render_header('Partner Labs', $u);
?>
<div class="page-header"><div><h1>Partner labs</h1><p class="page-sub">Tests your centre doesn't run are sent to a partner lab with a target turnaround.</p></div></div>
<form method="post" class="card"><?= csrf_field() ?><h3>Add partner lab</h3>
  <div class="grid"><label>Name <input name="name" placeholder="Visakhapatnam Partner Lab" required></label><label>City <input name="city"></label>
  <label>Contact phone <input name="contact_phone"></label><label>Default turnaround (hours) <input type="number" name="default_turnaround_hours" value="24" min="1"></label></div>
  <button class="btn">Add lab</button></form>
<?php if ($labs): ?><table><tr><th>Lab</th><th>City</th><th>Phone</th><th>Turnaround</th><th></th></tr>
<?php foreach ($labs as $l): ?><tr><td><?= h($l['name']) ?> <?= $l['is_active'] ? '' : '<span class="badge s-CANCELLED">Inactive</span>' ?></td><td><?= h($l['city']) ?></td><td><?= h($l['contact_phone']) ?></td><td><?= (int)$l['default_turnaround_hours'] ?> h</td>
<td><form method="post"><?= csrf_field() ?><input type="hidden" name="action" value="toggle"><input type="hidden" name="id" value="<?= (int)$l['id'] ?>"><button class="btn small secondary"><?= $l['is_active'] ? 'Disable' : 'Enable' ?></button></form></td></tr><?php endforeach; ?></table><?php endif; ?>

<h2>Test routing</h2>
<table><tr><th>Test</th><th>Processed at</th><th>Turnaround</th><th></th></tr>
<?php foreach ($tests as $t): $fid = 'r' . (int)$t['id']; ?>
<tr><td><?= h($t['name']) ?></td>
<td><select form="<?= $fid ?>" name="partner_lab_id"><option value="">In-house</option><?php foreach ($labs as $l): if (!$l['is_active']) continue; ?><option value="<?= (int)$l['id'] ?>" <?= (int)$t['partner_lab_id'] === (int)$l['id'] ? 'selected' : '' ?>><?= h($l['name']) ?></option><?php endforeach; ?></select></td>
<td><input form="<?= $fid ?>" type="number" name="turnaround_hours" min="1" value="<?= (int)$t['turnaround_hours'] ?>" style="width:90px"> h</td>
<td><form id="<?= $fid ?>" method="post"><?= csrf_field() ?><input type="hidden" name="action" value="route"><input type="hidden" name="test_id" value="<?= (int)$t['id'] ?>"><button class="btn small">Save</button></form></td></tr>
<?php endforeach; ?></table>
<?php render_footer();
