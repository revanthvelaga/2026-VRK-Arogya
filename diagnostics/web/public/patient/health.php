<?php
require __DIR__ . '/../../includes/bootstrap.php';
$u = require_role('PATIENT');
$pdo = db();
$uid = (int)$u['id'];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $a = $_POST['action'] ?? '';
    try {
        if ($a === 'vital') {
            $type = $_POST['type'] ?? '';
            if (!isset(VITAL_TYPES[$type]) || !is_numeric($_POST['value'] ?? '')) throw new InvalidArgumentException('Choose a type and enter a number.');
            if ($type === 'BP' && !is_numeric($_POST['value2'] ?? '')) throw new InvalidArgumentException('Blood pressure needs both numbers (e.g. 120 / 80).');
            $at = ($_POST['recorded_at'] ?? '') ? strtotime($_POST['recorded_at']) : time();
            if (!$at || $at > time() + 300) throw new InvalidArgumentException("A reading can't be in the future.");
            $pdo->prepare('INSERT INTO vital_readings (user_id,type,value,value2,recorded_at,note) VALUES (?,?,?,?,?,?)')
                ->execute([$uid, $type, (float)$_POST['value'], $type === 'BP' ? (float)$_POST['value2'] : null, date('Y-m-d H:i:s', $at), mb_substr(trim($_POST['note'] ?? ''), 0, 200) ?: null]);
            flash('Reading saved.');
        } elseif ($a === 'del_vital') {
            $pdo->prepare('DELETE FROM vital_readings WHERE id=? AND user_id=?')->execute([(int)$_POST['id'], $uid]);
        } elseif ($a === 'goal') {
            $metric = $_POST['metric'] ?? ''; $dir = $_POST['direction'] ?? '';
            if ((!isset(VITAL_TYPES[$metric]) && !preg_match('/^test:\d+$/', $metric)) || !in_array($dir, ['BELOW', 'ABOVE'], true) || !is_numeric($_POST['target'] ?? '')) throw new InvalidArgumentException('Pick what to track, a direction and a target.');
            $label = isset(VITAL_TYPES[$metric]) ? VITAL_TYPES[$metric][0] : (function ($m) use ($pdo) { $s = $pdo->prepare('SELECT name FROM tests WHERE id=?'); $s->execute([(int)substr($m, 5)]); return $s->fetchColumn() ?: 'Test'; })($metric);
            $unit = isset(VITAL_TYPES[$metric]) ? VITAL_TYPES[$metric][1] : null;
            $pdo->prepare('INSERT INTO health_goals (user_id,metric,label,direction,target,unit,start_value,target_date) VALUES (?,?,?,?,?,?,?,?)')
                ->execute([$uid, $metric, $label . ' ' . strtolower($dir) . ' ' . (float)$_POST['target'] . ($unit ? " $unit" : ''), $dir, (float)$_POST['target'], $unit, latest_metric($uid, $metric), ($_POST['target_date'] ?? '') ?: null]);
            flash('Goal added.');
        } elseif ($a === 'del_goal') {
            $pdo->prepare('DELETE FROM health_goals WHERE id=? AND user_id=?')->execute([(int)$_POST['id'], $uid]);
        } elseif ($a === 'medicine') {
            $name = trim($_POST['name'] ?? '');
            if ($name === '') throw new InvalidArgumentException('Medicine name is required.');
            $timings = array_values(array_intersect((array)($_POST['timings'] ?? []), ['MORNING', 'AFTERNOON', 'EVENING', 'NIGHT']));
            $pdo->prepare('INSERT INTO medicines (user_id,name,dosage,brand,timings,food,reminder) VALUES (?,?,?,?,?,?,?)')
                ->execute([$uid, mb_substr($name, 0, 120), mb_substr(trim($_POST['dosage'] ?? ''), 0, 80) ?: null, mb_substr(trim($_POST['brand'] ?? ''), 0, 80) ?: null,
                    $timings ? implode(',', $timings) : null, in_array($_POST['food'] ?? '', ['BEFORE', 'AFTER'], true) ? $_POST['food'] : null, !empty($_POST['reminder']) ? 1 : 0]);
            flash('Medicine added.');
        } elseif ($a === 'del_medicine') {
            $pdo->prepare('UPDATE medicines SET is_active=0 WHERE id=? AND user_id=?')->execute([(int)$_POST['id'], $uid]);
        }
    } catch (InvalidArgumentException $e) { flash($e->getMessage()); }
    redirect('/patient/health.php');
}
$v = $pdo->prepare('SELECT * FROM vital_readings WHERE user_id=? AND member_id IS NULL ORDER BY recorded_at DESC LIMIT 30'); $v->execute([$uid]);
$g = $pdo->prepare('SELECT * FROM health_goals WHERE user_id=? ORDER BY id DESC'); $g->execute([$uid]);
$m = $pdo->prepare('SELECT * FROM medicines WHERE user_id=? AND is_active=1 ORDER BY name'); $m->execute([$uid]);
$tests = $pdo->query('SELECT id, name FROM tests WHERE is_active=1 AND (normal_range_low IS NOT NULL OR normal_range_high IS NOT NULL) ORDER BY name')->fetchAll();
render_header('Health Tracker', $u);
?>
<div class="page-header"><div><h1>Health tracker</h1><p class="page-sub">Log home readings, set goals and keep a list of your medicines.</p></div><a class="btn secondary" href="/patient/insights.php">See insights</a></div>

<form method="post" class="card"><?= csrf_field() ?><input type="hidden" name="action" value="vital"><h3>Add a reading</h3>
  <div class="grid"><label>Type <select name="type" id="vtype"><?php foreach (VITAL_TYPES as $k => [$l, $un]): ?><option value="<?= $k ?>"><?= h($l) ?> (<?= h($un) ?>)</option><?php endforeach; ?></select></label>
  <label><span id="v1l">Systolic</span> <input name="value" type="number" step="any" required></label>
  <label id="v2"><span>Diastolic</span> <input name="value2" type="number" step="any"></label>
  <label>When <input name="recorded_at" type="datetime-local" max="<?= date('Y-m-d\TH:i') ?>"></label></div>
  <label>Note <input name="note" maxlength="200" placeholder="After breakfast, felt dizzy…"></label><button class="btn">Save reading</button></form>
<script>const vt=document.getElementById('vtype');function vs(){const bp=vt.value==='BP';document.getElementById('v2').style.display=bp?'':'none';document.getElementById('v1l').textContent=bp?'Systolic':'Value';}vt.onchange=vs;vs();</script>

<?php $rows = $v->fetchAll(); if ($rows): ?><table><tr><th>When</th><th>Reading</th><th>Note</th><th></th></tr>
<?php foreach ($rows as $r): ?><tr><td><?= h(date('d M, H:i', strtotime($r['recorded_at']))) ?></td><td><b><?= h(VITAL_TYPES[$r['type']][0]) ?></b>: <?= h(rtrim(rtrim($r['value'], '0'), '.')) ?><?= $r['type'] === 'BP' ? '/' . h(rtrim(rtrim($r['value2'], '0'), '.')) : '' ?> <?= h(VITAL_TYPES[$r['type']][1]) ?></td><td><?= h($r['note']) ?></td>
<td><form method="post"><?= csrf_field() ?><input type="hidden" name="action" value="del_vital"><input type="hidden" name="id" value="<?= (int)$r['id'] ?>"><button class="btn small danger">×</button></form></td></tr><?php endforeach; ?></table><?php endif; ?>

<form method="post" class="card"><?= csrf_field() ?><input type="hidden" name="action" value="goal"><h3>Set a goal</h3>
  <div class="grid"><label>Track <select name="metric"><?php foreach (VITAL_TYPES as $k => [$l]): if ($k === 'BP') continue; ?><option value="<?= $k ?>"><?= h($l) ?></option><?php endforeach; ?>
    <?php foreach ($tests as $t): ?><option value="test:<?= (int)$t['id'] ?>"><?= h($t['name']) ?> (lab)</option><?php endforeach; ?></select></label>
  <label>Keep it <select name="direction"><option value="BELOW">below</option><option value="ABOVE">above</option></select></label>
  <label>Target <input name="target" type="number" step="any" required></label><label>By (optional) <input name="target_date" type="date" min="<?= date('Y-m-d') ?>"></label></div>
  <button class="btn">Add goal</button></form>
<?php foreach ($g->fetchAll() as $go): ?><div class="card job-head" style="padding:12px 18px"><span><?= h($go['label']) ?></span>
<form method="post"><?= csrf_field() ?><input type="hidden" name="action" value="del_goal"><input type="hidden" name="id" value="<?= (int)$go['id'] ?>"><button class="btn small danger">Remove</button></form></div><?php endforeach; ?>

<form method="post" class="card"><?= csrf_field() ?><input type="hidden" name="action" value="medicine"><h3>My medicines</h3>
  <div class="grid"><label>Name <input name="name" required></label><label>Dosage <input name="dosage" placeholder="500 mg"></label><label>Brand <input name="brand"></label>
  <label>With food <select name="food"><option value="">—</option><option value="BEFORE">Before food</option><option value="AFTER">After food</option></select></label></div>
  <div class="grid"><?php foreach (['MORNING' => 'Morning', 'AFTERNOON' => 'Afternoon', 'EVENING' => 'Evening', 'NIGHT' => 'Night'] as $k => $l): ?><label><input type="checkbox" name="timings[]" value="<?= $k ?>"> <?= $l ?></label><?php endforeach; ?></div>
  <label><input type="checkbox" name="reminder" value="1" checked> Send me reminders</label><button class="btn">Add medicine</button></form>
<?php $meds = $m->fetchAll(); if ($meds): ?><table><tr><th>Medicine</th><th>When</th><th>Reminder</th><th></th></tr>
<?php foreach ($meds as $md): ?><tr><td><b><?= h($md['name']) ?></b> <?= h($md['dosage']) ?><br><small><?= h($md['brand']) ?></small></td><td><?= h(ucwords(strtolower(str_replace(',', ', ', (string)$md['timings'])))) ?><?= $md['food'] ? '<br><small>' . h(ucfirst(strtolower($md['food']))) . ' food</small>' : '' ?></td><td><?= $md['reminder'] ? 'On' : 'Off' ?></td>
<td><form method="post"><?= csrf_field() ?><input type="hidden" name="action" value="del_medicine"><input type="hidden" name="id" value="<?= (int)$md['id'] ?>"><button class="btn small danger">Remove</button></form></td></tr><?php endforeach; ?></table><?php endif; ?>
<?php render_footer();
