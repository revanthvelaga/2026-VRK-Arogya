<?php
require __DIR__ . '/../../includes/bootstrap.php';
$u = require_role('PATIENT');
$uid = (int)$u['id'];
$trends = lab_trends($uid);
$retest = array_filter(retest_items($uid), fn($r) => $r['state'] !== 'OK');
$g = db()->prepare('SELECT * FROM health_goals WHERE user_id=? ORDER BY id DESC'); $g->execute([$uid]);
$goals = $g->fetchAll();

// Latest abnormal values across all reports
$flags = [];
foreach ($trends as $name => $rows) { $last = end($rows); if ($last['is_abnormal']) $flags[] = $last; }

// Latest vitals by type
$vitals = [];
$v = db()->prepare('SELECT * FROM vital_readings WHERE user_id=? AND member_id IS NULL ORDER BY recorded_at'); $v->execute([$uid]);
foreach ($v->fetchAll() as $r) $vitals[$r['type']][] = $r;

render_header('Insights', $u);
?>
<div class="page-header"><div><h1>Health insights</h1><p class="page-sub">Your lab results over time, home readings and goals in one place.</p></div><a class="btn secondary" href="/patient/health.php">Add a reading</a></div>

<?php if ($flags): ?><div class="card" style="border-color:rgba(208,52,44,.3);background:var(--red-soft)"><h3 style="color:var(--red)">Needs attention</h3>
<?php foreach ($flags as $f): ?><p style="margin:4px 0"><b><?= h($f['test_name']) ?></b>: <?= h(rtrim(rtrim($f['value'], '0'), '.')) ?> <?= h($f['unit']) ?> <small>(normal <?= h($f['normal_low'] ?? '–') ?>–<?= h($f['normal_high'] ?? '–') ?>)</small></p><?php endforeach; ?>
<small>Please discuss out-of-range results with your doctor.</small></div><?php endif; ?>

<?php if ($retest): ?><div class="card"><h3>Time to retest</h3>
<?php foreach ($retest as $r): ?><div class="job-head" style="padding:6px 0"><span><b><?= h($r['test_name']) ?></b> <small>last on <?= h(date('d M Y', strtotime($r['last_at']))) ?> · usually every <?= (int)$r['interval_days'] ?> days</small></span>
<span><span class="badge s-<?= $r['state'] === 'OVERDUE' ? 'CANCELLED' : 'ON_WAY' ?>"><?= $r['state'] === 'OVERDUE' ? 'Overdue' : 'Due in ' . $r['days_left'] . ' d' ?></span> <a class="btn small" href="/patient/book.php">Book</a></span></div><?php endforeach; ?></div><?php endif; ?>

<h2>Lab results</h2>
<?php if (!$trends): echo '<div class="card">' . empty_state('chart', 'Your results will appear here once your lab enters them.') . '</div>'; else: ?>
<div class="stat-grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">
<?php foreach ($trends as $name => $rows): $last = end($rows); $first = $rows[0]; ?>
<div class="stat-tile"><div class="l" style="margin:0 0 6px"><?= h($name) ?></div>
  <div class="n" style="font-size:24px<?= $last['is_abnormal'] ? ';background:none;color:var(--red);-webkit-text-fill-color:var(--red)' : '' ?>"><?= h(rtrim(rtrim($last['value'], '0'), '.')) ?> <small style="font-size:12px"><?= h($last['unit']) ?></small></div>
  <?= sparkline(array_map(fn($r) => (float)$r['value'], $rows), 200, 36) ?>
  <small><?= count($rows) ?> result<?= count($rows) > 1 ? 's' : '' ?> · since <?= h(date('M Y', strtotime($first['scheduled_at']))) ?></small></div>
<?php endforeach; ?></div><?php endif; ?>

<h2>Home readings</h2>
<?php if (!$vitals): echo '<div class="card">' . empty_state('flask', 'Log BP, sugar or weight from the Health Tracker.') . '</div>'; else: ?>
<div class="stat-grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">
<?php foreach ($vitals as $type => $rows): $last = end($rows); ?>
<div class="stat-tile"><div class="l" style="margin:0 0 6px"><?= h(VITAL_TYPES[$type][0]) ?></div>
  <div class="n" style="font-size:24px"><?= h(rtrim(rtrim($last['value'], '0'), '.')) ?><?= $type === 'BP' ? '/' . h(rtrim(rtrim($last['value2'], '0'), '.')) : '' ?> <small style="font-size:12px"><?= h(VITAL_TYPES[$type][1]) ?></small></div>
  <?= sparkline(array_map(fn($r) => (float)$r['value'], array_slice($rows, -20)), 180, 36) ?>
  <small>Last on <?= h(date('d M', strtotime($last['recorded_at']))) ?></small></div>
<?php endforeach; ?></div><?php endif; ?>

<h2>Goals</h2>
<?php if (!$goals): echo '<div class="card">' . empty_state('check', 'Set a goal like "Weight below 75 kg" in the Health Tracker.') . '</div>'; else: foreach ($goals as $go): $cur = latest_metric($uid, $go['metric']); $p = goal_progress($go, $cur); ?>
<div class="card" style="padding:14px 18px"><div class="job-head"><b><?= h($go['label']) ?></b><small><?= $cur !== null ? 'Now ' . h(rtrim(rtrim((string)$cur, '0'), '.')) . ' ' . h($go['unit']) : 'No reading yet' ?><?= $go['target_date'] ? ' · by ' . h(date('d M Y', strtotime($go['target_date']))) : '' ?></small></div>
<div style="height:8px;background:var(--surface-2);border-radius:99px;margin-top:10px;overflow:hidden"><div style="height:100%;width:<?= (int)($p ?? 0) ?>%;background:var(--gradient)"></div></div>
<small><?= $p === 100 ? 'Goal reached 🎉' : ($p === null ? '' : $p . '% of the way') ?></small></div>
<?php endforeach; endif; ?>
<p class="page-sub" style="margin-top:20px">Insights are for tracking only and are not medical advice.</p>
<?php render_footer();
