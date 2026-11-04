<?php
require __DIR__ . '/../../includes/bootstrap.php';
$u = require_role('PATIENT');
$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    try {
        $id = create_appointment((int)$u['id'], (array)($_POST['tests'] ?? []), ($_POST['date'] ?? '') . ' ' . ($_POST['time'] ?? ''), (string)($_POST['address'] ?? ''), null, null, [
            'package_ids' => (array)($_POST['packages'] ?? []),
            'collection_mode' => $_POST['collection_mode'] ?? 'HOME_VISIT',
            'pickup_point_id' => $_POST['pickup_point_id'] ?? null,
            'coupon_code' => trim($_POST['coupon_code'] ?? ''),
            'member_id' => $_POST['member_id'] ?? null,
            'use_wallet' => !empty($_POST['use_wallet']),
        ]);
        flash("Appointment #$id booked.");
        redirect('/patient/appointment.php?id=' . $id);
    } catch (InvalidArgumentException $e) { $error = $e->getMessage(); }
}
$pdo = db();
$tests = $pdo->query('SELECT t.*, l.name AS lab_name FROM tests t LEFT JOIN partner_labs l ON l.id=t.partner_lab_id WHERE t.is_active=1 ORDER BY t.name')->fetchAll();
$pkgs = $pdo->query('SELECT * FROM packages WHERE is_active=1 ORDER BY price')->fetchAll();
$pkgTests = [];
foreach ($pdo->query('SELECT pt.package_id, t.name FROM package_tests pt JOIN tests t ON t.id=pt.test_id')->fetchAll() as $r) $pkgTests[$r['package_id']][] = $r['name'];
$points = $pdo->query('SELECT pp.id, pp.name, pp.village_name, pp.distance_km FROM pickup_points pp JOIN centers c ON c.id=pp.center_id WHERE pp.is_active=1 AND c.is_active=1 ORDER BY pp.distance_km')->fetchAll();
$offers = $pdo->query("SELECT code, description FROM coupons WHERE is_active=1 AND (valid_until IS NULL OR valid_until > NOW()) ORDER BY created_at DESC LIMIT 5")->fetchAll();
$sel = fn($k, $v) => in_array((string)$v, array_map('strval', (array)($_POST[$k] ?? [])), true) ? 'checked' : '';
$mode = $_POST['collection_mode'] ?? 'HOME_VISIT';
$mm = $pdo->prepare('SELECT id, full_name, relation FROM family_members WHERE owner_id=? AND is_active=1 ORDER BY full_name'); $mm->execute([$u['id']]);
$members = $mm->fetchAll();
$walletBal = wallet_balance((int)$u['id']);

render_header('Book a Test', $u);
?>
<div class="page-header"><div><h1>Book a test</h1><p class="page-sub">Pick tests or a checkup package, choose how we collect your sample, and apply an offer.</p></div></div>
<?php if ($error): ?><div class="flash err"><?= h($error) ?></div><?php endif; ?>
<form method="post" id="bookform">
  <?= csrf_field() ?>
  <?php if ($pkgs): ?><div class="card"><h3>Health packages</h3>
    <?php foreach ($pkgs as $p): ?>
    <label data-price="<?= h($p['price']) ?>"><span style="display:flex;gap:10px;align-items:center"><input type="checkbox" name="packages[]" value="<?= (int)$p['id'] ?>" <?= $sel('packages', $p['id']) ?>>
      <span><b><?= h($p['name']) ?></b> <?= $p['tier'] ? '<span class="badge s-ASSIGNED">' . h($p['tier']) . '</span>' : '' ?> — ₹<?= number_format((float)$p['price'], 0) ?><br>
      <small><?= h(implode(', ', $pkgTests[$p['id']] ?? [])) ?></small></span></span></label>
    <?php endforeach; ?></div><?php endif; ?>

  <div class="card"><h3>Individual tests</h3>
    <?php foreach ($tests as $t): ?>
    <label data-price="<?= h($t['price']) ?>"><span style="display:flex;gap:10px;align-items:center"><input type="checkbox" name="tests[]" value="<?= (int)$t['id'] ?>" <?= $sel('tests', $t['id']) ?>>
      <span><?= h($t['name']) ?> — ₹<?= number_format((float)$t['price'], 0) ?>
      <?php if (!$t['is_in_house']): ?><br><small>Processed at <?= h($t['lab_name'] ?: 'partner lab') ?> · result in about <?= (int)$t['turnaround_hours'] ?> h</small><?php endif; ?></span></span></label>
    <?php endforeach; ?></div>

  <?php if ($members): ?><div class="card"><h3>Who is this test for?</h3><label><select name="member_id"><option value="">Myself</option>
    <?php foreach ($members as $m): ?><option value="<?= (int)$m['id'] ?>" <?= ($_POST['member_id'] ?? '') == $m['id'] ? 'selected' : '' ?>><?= h($m['full_name']) ?> (<?= h($m['relation']) ?>)</option><?php endforeach; ?></select></label></div><?php endif; ?>

  <div class="card"><h3>How should we collect your sample?</h3>
    <label><select name="collection_mode" id="mode">
      <option value="HOME_VISIT" <?= $mode === 'HOME_VISIT' ? 'selected' : '' ?>>Technician visits my address</option>
      <?php if ($points): ?><option value="PICKUP_POINT" <?= $mode === 'PICKUP_POINT' ? 'selected' : '' ?>>I'll go to a village pickup point</option><?php endif; ?>
      <option value="WALK_IN" <?= $mode === 'WALK_IN' ? 'selected' : '' ?>>I'll walk in to the centre</option></select></label>
    <div id="m-home"><label>Collection address <textarea name="address" rows="3"><?= h($_POST['address'] ?? $u['address'] ?? '') ?></textarea></label></div>
    <div id="m-pickup" style="display:none"><label>Pickup point <select name="pickup_point_id"><option value="">Choose…</option>
      <?php foreach ($points as $p): ?><option value="<?= (int)$p['id'] ?>" <?= ($_POST['pickup_point_id'] ?? '') == $p['id'] ? 'selected' : '' ?>><?= h($p['name']) ?><?= $p['village_name'] ? ' — ' . h($p['village_name']) : '' ?> (<?= h($p['distance_km']) ?> km from centre)</option><?php endforeach; ?></select></label>
      <small>Technicians visit each pickup point on its schedule. Pick a date that matches.</small></div>
    <div class="grid"><label>Date <input type="date" name="date" min="<?= date('Y-m-d') ?>" value="<?= h($_POST['date'] ?? '') ?>" required></label>
    <label>Time <input type="time" name="time" value="<?= h($_POST['time'] ?? '') ?>" required></label></div></div>

  <div class="card"><h3>Offer code</h3>
    <div style="display:flex;gap:8px"><input name="coupon_code" id="coupon" placeholder="Enter code" value="<?= h($_POST['coupon_code'] ?? '') ?>" style="text-transform:uppercase"><button type="button" class="btn secondary" id="apply">Apply</button></div>
    <p id="couponmsg" class="page-sub"></p>
    <?php foreach ($offers as $o): ?><span class="hero-chip" style="cursor:pointer;margin:4px 6px 0 0" onclick="document.getElementById('coupon').value='<?= h($o['code']) ?>';document.getElementById('apply').click()"><b><?= h($o['code']) ?></b> · <?= h($o['description']) ?></span><?php endforeach; ?></div>

  <?php if ($walletBal > 0): ?><div class="card"><label style="margin:0"><span style="display:flex;gap:10px;align-items:center"><input type="checkbox" name="use_wallet" value="1" id="usewallet" <?= !empty($_POST['use_wallet']) ? 'checked' : '' ?>> Use my wallet balance (₹<?= number_format($walletBal, 0) ?> available)</span></label></div><?php endif; ?>

  <div class="card" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
    <div><div class="hero-label" style="margin:0">Estimated total</div><div class="hero-figure" id="total" style="font-size:34px">₹0</div></div>
    <button class="btn">Confirm booking</button></div>
</form>
<script>
const f = document.getElementById('bookform'), mode = document.getElementById('mode');
let discount = 0;
function sub(){ let s = 0; f.querySelectorAll('label[data-price] input[type=checkbox]:checked').forEach(c => s += parseFloat(c.closest('label').dataset.price || 0)); return s; }
function refresh(){
  document.getElementById('m-home').style.display = mode.value === 'HOME_VISIT' ? '' : 'none';
  document.getElementById('m-pickup').style.display = mode.value === 'PICKUP_POINT' ? '' : 'none';
  let t = Math.max(0, sub() - discount); const w = document.getElementById('usewallet');
  if (w && w.checked) t = Math.max(0, t - <?= (float)$walletBal ?>); 
  document.getElementById('total').textContent = '₹' + t.toLocaleString('en-IN');
}
f.addEventListener('change', e => { if (e.target.type === 'checkbox' && e.target.id !== 'usewallet') { discount = 0; document.getElementById('couponmsg').textContent = ''; } refresh(); });
document.getElementById('apply').onclick = async () => {
  const code = document.getElementById('coupon').value.trim(), msg = document.getElementById('couponmsg');
  if (!code) return;
  const r = await fetch('/patient/coupon_quote.php?code=' + encodeURIComponent(code) + '&subtotal=' + sub());
  const j = await r.json();
  if (j.error) { discount = 0; msg.textContent = j.error; msg.style.color = 'var(--red)'; }
  else { discount = j.discount; msg.textContent = j.code + ': you save ₹' + j.discount + '. ' + j.description; msg.style.color = 'var(--accent-ink)'; }
  refresh();
};
mode.addEventListener('change', refresh); refresh();
</script>
<?php render_footer();
