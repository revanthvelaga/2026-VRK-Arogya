<?php
require __DIR__ . '/../../includes/bootstrap.php';
$u = require_role('ADMIN');
$pdo = db();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    if (($_POST['action'] ?? '') === 'toggle') {
        $pdo->prepare('UPDATE coupons SET is_active = 1 - is_active WHERE id=?')->execute([(int)$_POST['id']]);
        flash('Offer updated.');
    } else {
        $code = strtoupper(trim($_POST['code'] ?? ''));
        $type = $_POST['discount_type'] ?? '';
        $value = (float)($_POST['value'] ?? 0);
        if (!preg_match('/^[A-Z0-9]{3,30}$/', $code) || !in_array($type, ['PERCENT', 'FLAT'], true) || $value <= 0 || trim($_POST['description'] ?? '') === '') {
            flash('Code (letters/digits), description, type and a positive value are required.');
        } elseif ($type === 'PERCENT' && $value > 100) {
            flash('A percentage discount cannot exceed 100.');
        } else {
            try {
                $pdo->prepare('INSERT INTO coupons (code,description,discount_type,value,max_discount,min_order,valid_until,usage_limit,per_customer_limit) VALUES (?,?,?,?,?,?,?,?,?)')
                    ->execute([$code, trim($_POST['description']), $type, $value, ($_POST['max_discount'] ?? '') !== '' ? (float)$_POST['max_discount'] : null,
                        (float)($_POST['min_order'] ?? 0), ($_POST['valid_until'] ?? '') ?: null, ($_POST['usage_limit'] ?? '') !== '' ? (int)$_POST['usage_limit'] : null, max(1, (int)($_POST['per_customer_limit'] ?? 1))]);
                flash("Offer $code created.");
            } catch (PDOException $e) { flash("Coupon $code already exists."); }
        }
    }
    redirect('/admin/coupons.php');
}
$rows = $pdo->query("SELECT c.*, (SELECT COUNT(*) FROM appointments a WHERE a.coupon_code=c.code AND a.status<>'CANCELLED') AS used FROM coupons c ORDER BY c.created_at DESC")->fetchAll();
render_header('Offers', $u);
?>
<div class="page-header"><div><h1>Offers &amp; coupons</h1><p class="page-sub">Codes patients enter at checkout. Cancelled bookings give the redemption back.</p></div></div>
<form method="post" class="card"><?= csrf_field() ?><h3>New offer</h3>
  <div class="grid"><label>Code <input name="code" placeholder="FIRST20" required></label><label>Description <input name="description" required></label>
  <label>Type <select name="discount_type"><option value="PERCENT">Percent</option><option value="FLAT">Flat ₹</option></select></label><label>Value <input type="number" step="0.01" min="0.01" name="value" required></label>
  <label>Max discount (₹) <input type="number" step="0.01" name="max_discount"></label><label>Min order (₹) <input type="number" step="0.01" name="min_order" value="0"></label>
  <label>Valid until <input type="datetime-local" name="valid_until"></label><label>Total uses (blank = unlimited) <input type="number" name="usage_limit" min="1"></label>
  <label>Uses per customer <input type="number" name="per_customer_limit" value="1" min="1"></label></div>
  <button class="btn">Create offer</button></form>
<?php if (!$rows): echo '<div class="card">' . empty_state('wallet', 'No offers yet.') . '</div>'; else: ?>
<table><tr><th>Code</th><th>Offer</th><th>Rules</th><th>Used</th><th></th></tr>
<?php foreach ($rows as $c): ?><tr><td><strong><?= h($c['code']) ?></strong> <?= $c['is_active'] ? '' : '<span class="badge s-CANCELLED">Off</span>' ?></td>
<td><?= h($c['description']) ?><br><small><?= $c['discount_type'] === 'PERCENT' ? h(rtrim(rtrim($c['value'], '0'), '.')) . '%' : '₹' . h(rtrim(rtrim($c['value'], '0'), '.')) ?><?= $c['max_discount'] !== null ? ' up to ₹' . h(rtrim(rtrim($c['max_discount'], '0'), '.')) : '' ?></small></td>
<td><small>Min ₹<?= h(rtrim(rtrim($c['min_order'], '0'), '.') ?: '0') ?> · <?= (int)$c['per_customer_limit'] ?>/customer<?= $c['valid_until'] ? ' · till ' . h(date('d M Y', strtotime($c['valid_until']))) : '' ?></small></td>
<td><?= (int)$c['used'] ?><?= $c['usage_limit'] !== null ? ' / ' . (int)$c['usage_limit'] : '' ?></td>
<td><form method="post"><?= csrf_field() ?><input type="hidden" name="action" value="toggle"><input type="hidden" name="id" value="<?= (int)$c['id'] ?>"><button class="btn small secondary"><?= $c['is_active'] ? 'Disable' : 'Enable' ?></button></form></td></tr>
<?php endforeach; ?></table><?php endif; ?>
<?php render_footer();
