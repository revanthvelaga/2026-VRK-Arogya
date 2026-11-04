<?php
// Public, time-limited view of a shared report for a doctor. Shows the
// patient's first name only (no phone or address), the values and the PDF.
require __DIR__ . '/../includes/bootstrap.php';
header('X-Robots-Tag: noindex');
header('Referrer-Policy: no-referrer');
$share = resolve_share((string)($_GET['t'] ?? ''));
if (!$share) { http_response_code(410); render_header('Link expired', null); echo '<div class="card">' . empty_state('clock', 'This link has expired or was revoked. Ask the patient for a new one.') . '</div>'; render_footer(); exit; }

$pdo = db();
if (isset($_GET['file'])) {
    // Download a report PDF through the share link
    $r = $pdo->prepare('SELECT * FROM reports WHERE id=? AND appointment_id=?'); $r->execute([(int)$_GET['file'], $share['appointment_id']]);
    $rep = $r->fetch();
    $path = $rep ? rtrim(UPLOAD_DIR, '/') . '/' . basename($rep['file_name']) : '';
    if (!$rep || !is_file($path)) { http_response_code(404); exit('Not found'); }
    header('Content-Type: application/pdf');
    header('Content-Disposition: inline; filename="report.pdf"');
    readfile($path); exit;
}
$pdo->prepare('UPDATE report_shares SET view_count = view_count + 1 WHERE id=?')->execute([$share['id']]);
$a = $pdo->prepare('SELECT a.scheduled_at, COALESCE(m.full_name, p.full_name) AS name, COALESCE(m.gender, p.gender) AS gender, COALESCE(m.dob, p.dob) AS dob
    FROM appointments a JOIN users p ON p.id=a.patient_id LEFT JOIN family_members m ON m.id=a.member_id WHERE a.id=?');
$a->execute([$share['appointment_id']]);
$info = $a->fetch();
$vals = $pdo->prepare('SELECT * FROM report_values WHERE appointment_id=? ORDER BY test_name'); $vals->execute([$share['appointment_id']]);
$files = $pdo->prepare('SELECT id, uploaded_at FROM reports WHERE appointment_id=? ORDER BY id DESC'); $files->execute([$share['appointment_id']]);
$age = $info['dob'] ? (int)floor((time() - strtotime($info['dob'])) / 31557600) : null;
render_header('Shared report', null);
?>
<h1>Lab report</h1>
<p class="page-sub"><?= h(explode(' ', $info['name'])[0]) ?><?= $age !== null ? ' · ' . $age . ' yrs' : '' ?><?= $info['gender'] ? ' · ' . h(['M' => 'Male', 'F' => 'Female', 'O' => 'Other'][$info['gender']]) : '' ?> · Tested <?= h(date('d M Y', strtotime($info['scheduled_at']))) ?></p>
<?php $rows = $vals->fetchAll(); if ($rows): ?>
<table><tr><th>Test</th><th>Result</th><th>Normal range</th></tr>
<?php foreach ($rows as $r): ?><tr><td><?= h($r['test_name']) ?></td><td style="<?= $r['is_abnormal'] ? 'color:var(--red);font-weight:700' : '' ?>"><?= h(rtrim(rtrim($r['value'], '0'), '.')) ?> <?= h($r['unit']) ?><?= $r['is_abnormal'] ? ' ⚠' : '' ?></td><td><?= h($r['normal_low'] ?? '–') ?> – <?= h($r['normal_high'] ?? '–') ?></td></tr><?php endforeach; ?></table>
<?php endif; ?>
<?php foreach ($files->fetchAll() as $f): ?><p><a class="btn" href="?t=<?= h($_GET['t']) ?>&file=<?= (int)$f['id'] ?>" target="_blank">Open report PDF</a></p><?php endforeach; ?>
<p class="page-sub">This link expires on <?= h(date('d M Y, H:i', strtotime($share['expires_at']))) ?>.</p>
<?php render_footer();
