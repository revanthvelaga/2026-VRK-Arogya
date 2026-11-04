<?php
require __DIR__ . '/../../includes/bootstrap.php';
$u = require_role('ADMIN');
$pdo = db();

$counts = $pdo->query('SELECT status, COUNT(*) c FROM appointments GROUP BY status')->fetchAll(PDO::FETCH_KEY_PAIR);
$today = $pdo->query("SELECT COUNT(*) c, COALESCE(SUM(total_amount),0) s FROM appointments WHERE DATE(created_at)=CURDATE() AND status<>'CANCELLED'")->fetch();
$week = $pdo->query("SELECT COALESCE(SUM(total_amount),0) FROM appointments WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) AND status<>'CANCELLED'")->fetchColumn();
$prev = $pdo->query("SELECT COALESCE(SUM(total_amount),0) FROM appointments WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 13 DAY) AND created_at < DATE_SUB(CURDATE(), INTERVAL 6 DAY) AND status<>'CANCELLED'")->fetchColumn();
$pending = $pdo->query("SELECT COALESCE(SUM(total_amount),0) FROM appointments WHERE payment_status='PENDING' AND status<>'CANCELLED'")->fetchColumn();

// Last 14 days billed amount for the sparkline (missing days = 0)
$rows = $pdo->query("SELECT DATE(created_at) d, SUM(total_amount) s FROM appointments WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 13 DAY) AND status<>'CANCELLED' GROUP BY d")->fetchAll(PDO::FETCH_KEY_PAIR);
$points = [];
for ($i = 13; $i >= 0; $i--) $points[] = (float)($rows[date('Y-m-d', strtotime("-$i day"))] ?? 0);

$w = 220; $hgt = 64; $max = max(1, ...$points);
$coords = [];
foreach ($points as $i => $v) $coords[] = [round($i * $w / 13, 1), round($hgt - ($v / $max) * ($hgt - 6) - 3, 1)];
$line = '';
foreach ($coords as $i => [$x, $y]) $line .= ($i ? 'L' : 'M') . "$x,$y";
$fill = "M0,$hgt " . implode(' ', array_map(fn($c) => "L{$c[0]},{$c[1]}", $coords)) . " L$w,$hgt Z";

$delta = $prev > 0 ? round((($week - $prev) / $prev) * 100) : null;
$recent = $pdo->query('SELECT a.id, a.scheduled_at, a.status, a.total_amount, p.full_name FROM appointments a JOIN users p ON p.id=a.patient_id ORDER BY a.id DESC LIMIT 6')->fetchAll();

render_header('Dashboard', $u);
?>
<div class="page-header"><div><h1><?= h(greeting()) ?>, <?= h(explode(' ', $u['full_name'])[0]) ?></h1><p class="page-sub">Here's what's happening at the centre today.</p></div>
  <a class="btn" href="/admin/appointments.php">Manage appointments</a></div>

<div class="hero-card"><div class="hero-inner"><div>
  <div class="hero-eyebrow">Last 7 days</div>
  <div class="hero-label">Billed amount</div>
  <div class="hero-figure"><?= h(money($week)) ?></div>
  <div class="hero-meta">
    <span class="hero-chip"><?= nav_icon('cal', 14) ?> <?= (int)$today['c'] ?> orders today (<?= h(money($today['s'])) ?>)</span>
    <span class="hero-chip" style="color:var(--amber)"><?= nav_icon('wallet', 14) ?> <?= h(money($pending)) ?> payment pending</span>
    <?php if ($delta !== null): ?><span class="hero-chip"><?= $delta >= 0 ? '▲' : '▼' ?> <?= abs($delta) ?>% vs previous week</span><?php endif; ?>
  </div></div>
  <svg class="hero-spark" width="<?= $w ?>" height="<?= $hgt ?>" viewBox="0 0 <?= $w ?> <?= $hgt ?>" aria-hidden="true">
    <defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#0ea5a0" stop-opacity=".35"/><stop offset="100%" stop-color="#0ea5a0" stop-opacity="0"/></linearGradient></defs>
    <path d="<?= h($fill) ?>" fill="url(#sg)"/><path class="hero-spark-line" d="<?= h($line) ?>"/></svg>
</div></div>

<div class="stat-grid">
<?php $icons = ['BOOKED' => 'inbox', 'ASSIGNED' => 'users', 'ON_WAY' => 'truck', 'SAMPLE_COLLECTED' => 'flask', 'REPORT_READY' => 'check', 'CANCELLED' => 'clock'];
foreach (STATUS_LABELS as $k => $label): ?>
  <a class="stat-tile" style="text-decoration:none" href="/admin/appointments.php?status=<?= h($k) ?>"><div class="stat-icon"><?= nav_icon($icons[$k], 16) ?></div><div class="n"><?= (int)($counts[$k] ?? 0) ?></div><div class="l"><?= h($label) ?></div></a>
<?php endforeach; ?>
</div>

<h2>Recent appointments</h2>
<?php if (!$recent): echo '<div class="card">' . empty_state('inbox', 'No appointments yet. They will show up here as patients book.') . '</div>'; else: ?>
<table><tr><th>#</th><th>Patient</th><th>When</th><th>Status</th><th>Amount</th></tr>
<?php foreach ($recent as $a): ?>
<tr><td><?= (int)$a['id'] ?></td><td><?= h($a['full_name']) ?></td><td><?= h(date('d M, H:i', strtotime($a['scheduled_at']))) ?></td>
<td><span class="badge s-<?= h($a['status']) ?>"><?= h(STATUS_LABELS[$a['status']]) ?></span></td><td><?= h(money($a['total_amount'])) ?></td></tr>
<?php endforeach; ?></table>
<?php endif; ?>
<?php render_footer();
