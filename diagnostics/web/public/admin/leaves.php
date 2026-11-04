<?php
require __DIR__ . '/../../includes/bootstrap.php';
$u = require_role('ADMIN');
$pdo = db();

/** India public holidays from Google's public calendar feed (no API key). Only "Public holiday" events. */
function import_google_holidays(): int {
    $url = 'https://calendar.google.com/calendar/ical/en.indian%23holiday%40group.v.calendar.google.com/public/basic.ics';
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15, CURLOPT_FOLLOWLOCATION => true]);
    $ics = (string)curl_exec($ch);
    $ok = curl_getinfo($ch, CURLINFO_HTTP_CODE) === 200;
    curl_close($ch);
    if (!$ok || $ics === '') throw new InvalidArgumentException('Could not reach the Google holiday calendar.');
    $ics = preg_replace("/\r?\n[ \t]/", '', $ics);   // unfold long lines
    $n = 0; $date = $name = $desc = null;
    $ins = db()->prepare("INSERT INTO holidays (holiday_date,name,source) VALUES (?,?,'GOOGLE') ON DUPLICATE KEY UPDATE name=IF(source='GOOGLE',VALUES(name),name)");
    foreach (preg_split("/\r?\n/", $ics) as $line) {
        if ($line === 'BEGIN:VEVENT') { $date = $name = $desc = null; continue; }
        if ($line === 'END:VEVENT') { if ($date && $name && str_starts_with((string)$desc, 'Public holiday')) { $ins->execute([$date, mb_substr($name, 0, 120)]); $n++; } continue; }
        if (str_starts_with($line, 'DTSTART') && preg_match('/(\d{4})(\d{2})(\d{2})$/', $line, $m)) $date = "$m[1]-$m[2]-$m[3]";
        elseif (str_starts_with($line, 'SUMMARY:')) $name = str_replace(['\\,', '\\n'], [',', ' '], substr($line, 8));
        elseif (str_starts_with($line, 'DESCRIPTION:')) $desc = substr($line, 12);
    }
    return $n;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $a = $_POST['action'] ?? '';
    try {
        if ($a === 'review' && in_array($_POST['status'] ?? '', ['APPROVED', 'REJECTED'], true)) {
            $l = $pdo->prepare("SELECT * FROM leaves WHERE id=? AND status='PENDING'"); $l->execute([(int)$_POST['id']]);
            if ($lv = $l->fetch()) {
                $pdo->prepare('UPDATE leaves SET status=?, reviewed_by=? WHERE id=?')->execute([$_POST['status'], $u['id'], $lv['id']]);
                notify((int)$lv['user_id'], 'Leave ' . strtolower($_POST['status']), date('d M', strtotime($lv['start_date'])) . ' – ' . date('d M', strtotime($lv['end_date'])));
                flash('Leave ' . strtolower($_POST['status']) . '.');
            }
        } elseif ($a === 'holiday') {
            if (!strtotime($_POST['holiday_date'] ?? '') || trim($_POST['name'] ?? '') === '') throw new InvalidArgumentException('Date and name are required.');
            $pdo->prepare("REPLACE INTO holidays (holiday_date,name,source) VALUES (?,?,'MANUAL')")->execute([$_POST['holiday_date'], mb_substr(trim($_POST['name']), 0, 120)]);
            flash('Holiday saved.');
        } elseif ($a === 'del_holiday') {
            $pdo->prepare('DELETE FROM holidays WHERE holiday_date=?')->execute([$_POST['holiday_date'] ?? '']);
        } elseif ($a === 'import') {
            flash(import_google_holidays() . ' public holidays imported from Google Calendar.');
        }
    } catch (InvalidArgumentException $e) { flash($e->getMessage()); }
    redirect('/admin/leaves.php');
}
$leaves = $pdo->query("SELECT l.*, u.full_name FROM leaves l JOIN users u ON u.id=l.user_id ORDER BY l.status='PENDING' DESC, l.start_date DESC LIMIT 100")->fetchAll();
$onLeave = $pdo->query("SELECT u.full_name FROM leaves l JOIN users u ON u.id=l.user_id WHERE l.status='APPROVED' AND CURDATE() BETWEEN l.start_date AND l.end_date")->fetchAll(PDO::FETCH_COLUMN);
$hol = $pdo->query('SELECT * FROM holidays WHERE holiday_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) ORDER BY holiday_date LIMIT 40')->fetchAll();
render_header('Leaves & Holidays', $u);
?>
<div class="page-header"><div><h1>Leaves &amp; holidays</h1><p class="page-sub"><?= $onLeave ? 'On leave today: ' . h(implode(', ', $onLeave)) : 'Nobody is on leave today.' ?></p></div></div>
<?php if (!$leaves): echo '<div class="card">' . empty_state('cal', 'No leave requests yet.') . '</div>'; else: ?>
<table><tr><th>Technician</th><th>Dates</th><th>Type</th><th>Reason</th><th>Status</th></tr>
<?php foreach ($leaves as $l): ?><tr><td><?= h($l['full_name']) ?></td><td><?= h(date('d M', strtotime($l['start_date']))) ?> – <?= h(date('d M Y', strtotime($l['end_date']))) ?></td><td><?= h($l['leave_type']) ?></td><td><?= h($l['reason']) ?></td>
<td><?php if ($l['status'] === 'PENDING'): ?><form method="post" style="display:flex;gap:6px"><?= csrf_field() ?><input type="hidden" name="action" value="review"><input type="hidden" name="id" value="<?= (int)$l['id'] ?>">
  <button class="btn small" name="status" value="APPROVED">Approve</button><button class="btn small danger" name="status" value="REJECTED">Reject</button></form>
<?php else: ?><span class="badge s-<?= $l['status'] === 'APPROVED' ? 'REPORT_READY' : 'CANCELLED' ?>"><?= h(ucfirst(strtolower($l['status']))) ?></span><?php endif; ?></td></tr><?php endforeach; ?></table><?php endif; ?>

<h2>Holidays</h2>
<div class="card"><form method="post" style="display:flex;gap:8px;flex-wrap:wrap"><?= csrf_field() ?><input type="hidden" name="action" value="holiday">
  <input type="date" name="holiday_date" required style="width:auto"><input name="name" placeholder="Sankranti" required style="width:auto;flex:1"><button class="btn">Add</button></form>
  <form method="post" style="margin-top:10px"><?= csrf_field() ?><input type="hidden" name="action" value="import"><button class="btn secondary small">Import India public holidays from Google Calendar</button></form></div>
<?php if ($hol): ?><table><tr><th>Date</th><th>Holiday</th><th></th></tr><?php foreach ($hol as $hh): ?><tr><td><?= h(date('D, d M Y', strtotime($hh['holiday_date']))) ?></td><td><?= h($hh['name']) ?> <?= $hh['source'] === 'GOOGLE' ? '<small>Google</small>' : '' ?></td>
<td><form method="post"><?= csrf_field() ?><input type="hidden" name="action" value="del_holiday"><input type="hidden" name="holiday_date" value="<?= h($hh['holiday_date']) ?>"><button class="btn small danger">×</button></form></td></tr><?php endforeach; ?></table><?php endif; ?>
<?php render_footer();
