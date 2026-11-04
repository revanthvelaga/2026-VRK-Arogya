<?php
require __DIR__ . '/../../includes/bootstrap.php';
$u = require_role('ADMIN');
$pdo = db();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $a = $_POST['action'] ?? '';
    try {
        if ($a === 'center') {
            $name = trim($_POST['name'] ?? ''); $lat = (float)($_POST['latitude'] ?? 0); $lng = (float)($_POST['longitude'] ?? 0);
            $r = (float)($_POST['service_radius_km'] ?? 20);
            if ($name === '' || abs($lat) > 90 || abs($lng) > 180 || $r <= 0) throw new InvalidArgumentException('Valid name, coordinates and radius are required.');
            $pdo->prepare('INSERT INTO centers (name,address,latitude,longitude,service_radius_km) VALUES (?,?,?,?,?)')->execute([$name, trim($_POST['address'] ?? '') ?: null, $lat, $lng, $r]);
            flash('Centre added.');
        } elseif ($a === 'point') {
            $cs = $pdo->prepare('SELECT * FROM centers WHERE id=?'); $cs->execute([(int)$_POST['center_id']]);
            $center = $cs->fetch() ?: throw new InvalidArgumentException('Centre not found.');
            $lat = (float)$_POST['latitude']; $lng = (float)$_POST['longitude']; $name = trim($_POST['name'] ?? '');
            if ($name === '') throw new InvalidArgumentException('Pickup point name is required.');
            $d = distance_within_radius($center, $lat, $lng);   // enforces the service radius (default 20 km)
            $pdo->prepare('INSERT INTO pickup_points (center_id,name,village_name,latitude,longitude,distance_km) VALUES (?,?,?,?,?,?)')
                ->execute([$center['id'], $name, trim($_POST['village_name'] ?? '') ?: null, $lat, $lng, $d]);
            flash(sprintf('Pickup point added (%.1f km from the centre).', $d));
        } elseif ($a === 'schedule') {
            $st = $_POST['start_time'] ?? ''; $en = $_POST['end_time'] ?? ''; $dow = (int)($_POST['day_of_week'] ?? -1);
            if ($dow < 0 || $dow > 6 || !$st || !$en || $en <= $st) throw new InvalidArgumentException('Choose a day and a valid time range.');
            $pdo->prepare('INSERT INTO pickup_point_schedules (pickup_point_id,day_of_week,start_time,end_time) VALUES (?,?,?,?)')->execute([(int)$_POST['pickup_point_id'], $dow, $st, $en]);
            flash('Visit schedule added.');
        } elseif ($a === 'del_schedule') {
            $pdo->prepare('DELETE FROM pickup_point_schedules WHERE id=?')->execute([(int)$_POST['id']]); flash('Schedule removed.');
        } elseif ($a === 'toggle_point') {
            $pdo->prepare('UPDATE pickup_points SET is_active = 1 - is_active WHERE id=?')->execute([(int)$_POST['id']]); flash('Pickup point updated.');
        } elseif ($a === 'toggle_center') {
            $pdo->prepare('UPDATE centers SET is_active = 1 - is_active WHERE id=?')->execute([(int)$_POST['id']]); flash('Centre updated.');
        }
    } catch (InvalidArgumentException $e) { flash($e->getMessage()); }
    redirect('/admin/centers.php');
}

$centers = $pdo->query('SELECT * FROM centers ORDER BY name')->fetchAll();
$points = $pdo->query('SELECT * FROM pickup_points ORDER BY name')->fetchAll();
$sched = [];
foreach ($pdo->query('SELECT * FROM pickup_point_schedules ORDER BY day_of_week, start_time')->fetchAll() as $s) $sched[$s['pickup_point_id']][] = $s;
$days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

render_header('Centres & Pickups', $u);
?>
<div class="page-header"><div><h1>Centres &amp; pickup points</h1><p class="page-sub">Villages and panchayat offices within a centre's service radius where samples are collected.</p></div></div>

<form method="post" class="card"><?= csrf_field() ?><input type="hidden" name="action" value="center"><h3>Add diagnostic centre</h3>
  <div class="grid"><label>Name <input name="name" required></label><label>Latitude <input name="latitude" type="number" step="any" required></label>
  <label>Longitude <input name="longitude" type="number" step="any" required></label><label>Service radius (km) <input name="service_radius_km" type="number" step="0.5" value="20" required></label></div>
  <label>Address <input name="address"></label><button class="btn">Add centre</button></form>

<?php foreach ($centers as $c): ?>
<div class="card"><div class="job-head"><h3 style="margin:0"><?= h($c['name']) ?> <?= $c['is_active'] ? '' : '<span class="badge s-CANCELLED">Inactive</span>' ?></h3>
  <form method="post"><?= csrf_field() ?><input type="hidden" name="action" value="toggle_center"><input type="hidden" name="id" value="<?= (int)$c['id'] ?>"><button class="btn small secondary"><?= $c['is_active'] ? 'Disable' : 'Enable' ?></button></form></div>
  <p class="page-sub"><?= h($c['address']) ?> · <?= h($c['latitude']) ?>, <?= h($c['longitude']) ?> · <?= h(rtrim(rtrim($c['service_radius_km'], '0'), '.')) ?> km radius</p>
  <form method="post"><?= csrf_field() ?><input type="hidden" name="action" value="point"><input type="hidden" name="center_id" value="<?= (int)$c['id'] ?>">
    <div class="grid"><label>Pickup point <input name="name" placeholder="Rachapalle Panchayat Office" required></label><label>Village <input name="village_name"></label>
    <label>Latitude <input name="latitude" type="number" step="any" required></label><label>Longitude <input name="longitude" type="number" step="any" required></label></div>
    <button class="btn small">Add pickup point</button></form>
  <?php $mine = array_filter($points, fn($p) => (int)$p['center_id'] === (int)$c['id']); if ($mine): ?>
  <table style="margin-top:14px"><tr><th>Pickup point</th><th>Distance</th><th>Visit schedule</th><th></th></tr>
  <?php foreach ($mine as $p): ?><tr><td><?= h($p['name']) ?><br><small><?= h($p['village_name']) ?></small></td><td><?= h($p['distance_km']) ?> km</td>
    <td><?php foreach ($sched[$p['id']] ?? [] as $s): ?><form method="post" style="display:inline"><?= csrf_field() ?><input type="hidden" name="action" value="del_schedule"><input type="hidden" name="id" value="<?= (int)$s['id'] ?>">
      <span class="badge"><?= $days[$s['day_of_week']] ?> <?= h(substr($s['start_time'], 0, 5)) ?>–<?= h(substr($s['end_time'], 0, 5)) ?></span> <button class="btn small danger" title="Remove">×</button></form> <?php endforeach; ?>
      <form method="post" style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap"><?= csrf_field() ?><input type="hidden" name="action" value="schedule"><input type="hidden" name="pickup_point_id" value="<?= (int)$p['id'] ?>">
        <select name="day_of_week" style="width:auto"><?php foreach ($days as $i => $d): ?><option value="<?= $i ?>"><?= $d ?></option><?php endforeach; ?></select>
        <input type="time" name="start_time" required style="width:auto"><input type="time" name="end_time" required style="width:auto"><button class="btn small">Add</button></form></td>
    <td><form method="post"><?= csrf_field() ?><input type="hidden" name="action" value="toggle_point"><input type="hidden" name="id" value="<?= (int)$p['id'] ?>"><button class="btn small secondary"><?= $p['is_active'] ? 'Disable' : 'Enable' ?></button></form></td></tr>
  <?php endforeach; ?></table><?php endif; ?>
</div>
<?php endforeach; if (!$centers) echo '<div class="card">' . empty_state('truck', 'Add your diagnostic centre first, then its pickup points.') . '</div>'; ?>
<?php render_footer();
