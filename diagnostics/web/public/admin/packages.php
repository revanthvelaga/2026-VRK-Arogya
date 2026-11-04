<?php
require __DIR__ . '/../../includes/bootstrap.php';
$u = require_role('ADMIN');
$pdo = db();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $action = $_POST['action'] ?? '';
    $name = trim($_POST['name'] ?? '');
    $price = (float)($_POST['price'] ?? 0);
    $tier = in_array($_POST['tier'] ?? '', ['BASIC', 'STANDARD', 'PREMIUM'], true) ? $_POST['tier'] : null;
    $testIds = array_values(array_unique(array_map('intval', (array)($_POST['tests'] ?? []))));

    if ($action === 'toggle') {
        $pdo->prepare('UPDATE packages SET is_active = 1 - is_active WHERE id=?')->execute([(int)$_POST['id']]);
        flash('Package updated.');
    } elseif ($name === '' || $price <= 0 || !$testIds) {
        flash('Name, a positive price and at least one test are required.');
    } else {
        $pdo->beginTransaction();
        try {
            if ($action === 'create') {
                $pdo->prepare('INSERT INTO packages (name,description,price,tier) VALUES (?,?,?,?)')->execute([$name, trim($_POST['description'] ?? '') ?: null, $price, $tier]);
                $pid = (int)$pdo->lastInsertId();
            } else {
                $pid = (int)$_POST['id'];
                $pdo->prepare('UPDATE packages SET name=?, description=?, price=?, tier=? WHERE id=?')->execute([$name, trim($_POST['description'] ?? '') ?: null, $price, $tier, $pid]);
                $pdo->prepare('DELETE FROM package_tests WHERE package_id=?')->execute([$pid]);
            }
            $ins = $pdo->prepare('INSERT INTO package_tests (package_id,test_id) VALUES (?,?)');
            foreach ($testIds as $t) $ins->execute([$pid, $t]);
            $pdo->commit();
            flash($action === 'create' ? 'Package added.' : 'Package updated.');
        } catch (Throwable $e) { $pdo->rollBack(); flash('Could not save package.'); }
    }
    redirect('/admin/packages.php');
}

$tests = $pdo->query('SELECT id, name, price FROM tests WHERE is_active=1 ORDER BY name')->fetchAll();
$pkgs = $pdo->query('SELECT * FROM packages ORDER BY price')->fetchAll();
$map = [];
foreach ($pdo->query('SELECT package_id, test_id FROM package_tests')->fetchAll() as $r) $map[$r['package_id']][] = (int)$r['test_id'];

function package_form(array $tests, array $p = [], array $selected = []): void { ?>
  <div class="grid"><label>Name <input name="name" value="<?= h($p['name'] ?? '') ?>" required></label>
  <label>Price (₹) <input type="number" step="0.01" min="0.01" name="price" value="<?= h($p['price'] ?? '') ?>" required></label>
  <label>Tier <select name="tier"><option value="">—</option><?php foreach (['BASIC', 'STANDARD', 'PREMIUM'] as $t): ?><option <?= ($p['tier'] ?? '') === $t ? 'selected' : '' ?>><?= $t ?></option><?php endforeach; ?></select></label></div>
  <label>Description <input name="description" value="<?= h($p['description'] ?? '') ?>"></label>
  <div class="grid"><?php foreach ($tests as $t): ?>
    <label><input type="checkbox" name="tests[]" value="<?= (int)$t['id'] ?>" <?= in_array((int)$t['id'], $selected, true) ? 'checked' : '' ?>> <?= h($t['name']) ?> <small>₹<?= number_format((float)$t['price'], 0) ?></small></label>
  <?php endforeach; ?></div>
<?php }

render_header('Packages', $u);
?>
<div class="page-header"><div><h1>Packages</h1><p class="page-sub">Bundle tests into discounted health checkups.</p></div></div>
<form method="post" class="card"><?= csrf_field() ?><input type="hidden" name="action" value="create"><h3>Add package</h3>
  <?php package_form($tests); ?><button class="btn">Add package</button></form>
<?php foreach ($pkgs as $p): ?>
<form method="post" class="card"><?= csrf_field() ?><input type="hidden" name="action" value="update"><input type="hidden" name="id" value="<?= (int)$p['id'] ?>">
  <h3><?= h($p['name']) ?> <?= $p['is_active'] ? '' : '<span class="badge s-CANCELLED">Disabled</span>' ?></h3>
  <?php package_form($tests, $p, $map[$p['id']] ?? []); ?>
  <button class="btn small">Save</button>
  <button class="btn small secondary" formaction="/admin/packages.php" name="action" value="toggle"><?= $p['is_active'] ? 'Disable' : 'Enable' ?></button>
</form>
<?php endforeach; ?>
<?php render_footer();
