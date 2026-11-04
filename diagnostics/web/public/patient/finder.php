<?php
require __DIR__ . '/../../includes/bootstrap.php';
require_once __DIR__ . '/../../includes/finder.php';
$u = require_role('PATIENT');
$q = trim($_POST['q'] ?? '');
$res = null; $err = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    try { $res = find_tests($q); } catch (InvalidArgumentException $e) { $err = $e->getMessage(); }
}
render_header('Test Finder', $u);
?>
<div class="page-header"><div><h1>Not sure which test?</h1><p class="page-sub">Tell us what you want to check, in your own words. We'll suggest tests from our catalogue.</p></div></div>
<form method="post" class="card"><?= csrf_field() ?>
  <label>What's on your mind? <textarea name="q" rows="3" maxlength="500" placeholder="e.g. I feel tired all the time and my mother has thyroid" required><?= h($q) ?></textarea></label>
  <button class="btn">Suggest tests</button></form>
<?php if ($err): ?><div class="flash err"><?= h($err) ?></div><?php endif; ?>
<?php if ($res): ?>
<div class="card"><p><?= h($res['summary']) ?></p>
<form method="post" action="/patient/book.php" id="pick"><?= csrf_field() ?>
<?php foreach ($res['packages'] as $p): ?><label><span style="display:flex;gap:10px;align-items:center"><input type="checkbox" name="packages[]" value="<?= (int)$p['id'] ?>" checked><span><b><?= h($p['name']) ?></b> — ₹<?= number_format((float)$p['price'], 0) ?><br><small><?= h($p['why']) ?></small></span></span></label><?php endforeach; ?>
<?php foreach ($res['tests'] as $t): ?><label><span style="display:flex;gap:10px;align-items:center"><input type="checkbox" name="tests[]" value="<?= (int)$t['id'] ?>" checked><span><b><?= h($t['name']) ?></b> — ₹<?= number_format((float)$t['price'], 0) ?><br><small><?= h($t['why']) ?></small></span></span></label><?php endforeach; ?>
<?php if ($res['tests'] || $res['packages']): ?><input type="hidden" name="prefill" value="1"><button class="btn">Continue to booking</button><?php endif; ?>
</form></div>
<p class="page-sub">Suggestions are a starting point, not a diagnosis. For chest pain, breathing trouble or other emergencies, get medical help right away.</p>
<?php endif; ?>
<?php render_footer();
