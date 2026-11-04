<?php
require __DIR__ . '/../../includes/bootstrap.php';
$u = require_role('ADMIN');
$pdo = db();
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $action = $_POST['action'] ?? '';
    $price = (float)($_POST['price'] ?? 0);
    $name = trim($_POST['name'] ?? '');
    if ($action === 'toggle') {
        $pdo->prepare('UPDATE tests SET is_active = 1 - is_active WHERE id=?')->execute([(int)$_POST['id']]);
        flash('Test updated.');
    } elseif ($name === '' || $price <= 0) {
        flash('Name and a positive price are required.');
    } elseif ($action === 'create') {
        $pdo->prepare('INSERT INTO tests (code,name,sample_type,price) VALUES (?,?,?,?)')
            ->execute([trim($_POST['code'] ?? '') ?: null, $name, trim($_POST['sample_type'] ?? '') ?: null, $price]);
        flash('Test added.');
    } elseif ($action === 'update') {
        $pdo->prepare('UPDATE tests SET code=?, name=?, sample_type=?, price=? WHERE id=?')
            ->execute([trim($_POST['code'] ?? '') ?: null, $name, trim($_POST['sample_type'] ?? '') ?: null, $price, (int)$_POST['id']]);
        flash('Rate card updated.');
    }
    redirect('/admin/tests.php');
}
$tests = $pdo->query('SELECT * FROM tests ORDER BY name')->fetchAll();
render_header('Tests & Rates', $u);
?>
<h1>Tests &amp; Rate Card</h1>
<form method="post" class="card"><?= csrf_field() ?><input type="hidden" name="action" value="create">
  <h3>Add test</h3>
  <div class="grid">
    <label>Code <input name="code"></label><label>Name <input name="name" required></label>
    <label>Sample type <input name="sample_type"></label><label>Price (₹) <input type="number" step="0.01" min="0.01" name="price" required></label>
  </div><button class="btn">Add</button>
</form>
<table><tr><th>Code</th><th>Name</th><th>Sample</th><th>Price</th><th>Active</th><th></th></tr>
<?php foreach ($tests as $t): ?>
<?php $fid = 'f' . (int)$t['id']; ?>
<tr>
  <td><input form="<?= $fid ?>" name="code" value="<?= h($t['code']) ?>"></td>
  <td><input form="<?= $fid ?>" name="name" value="<?= h($t['name']) ?>" required></td>
  <td><input form="<?= $fid ?>" name="sample_type" value="<?= h($t['sample_type']) ?>"></td>
  <td><input form="<?= $fid ?>" type="number" step="0.01" min="0.01" name="price" value="<?= h($t['price']) ?>" required></td>
  <td><?= $t['is_active'] ? 'Yes' : 'No' ?></td>
  <td>
    <form id="<?= $fid ?>" method="post" style="display:inline"><?= csrf_field() ?><input type="hidden" name="action" value="update"><input type="hidden" name="id" value="<?= (int)$t['id'] ?>"><button class="btn small">Save</button></form>
    <form method="post" style="display:inline"><?= csrf_field() ?><input type="hidden" name="action" value="toggle"><input type="hidden" name="id" value="<?= (int)$t['id'] ?>"><button class="btn small secondary"><?= $t['is_active'] ? 'Disable' : 'Enable' ?></button></form></td>
</tr>
<?php endforeach; ?></table>
<?php render_footer();
