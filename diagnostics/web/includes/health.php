<?php
declare(strict_types=1);
// Health tracking, report values, retest cadence, report sharing, staff
// alerts and push — ported from Arogya's health/reports/staff-alerts/push modules.

const VITAL_TYPES = [
    'BP' => ['Blood pressure', 'mmHg'], 'SUGAR_FASTING' => ['Sugar (fasting)', 'mg/dL'],
    'SUGAR_RANDOM' => ['Sugar (random)', 'mg/dL'], 'WEIGHT' => ['Weight', 'kg'], 'PULSE' => ['Pulse', 'bpm'],
];

/** How often a test is usually repeated (a reminder cadence, not medical advice). null = never remind. */
function retest_interval_days(string $testName): ?int {
    $rules = [['/a1c|hba1c/i', 90], ['/fasting blood sugar|\bfbs\b|glucose/i', 90], ['/lipid/i', 180], ['/thyroid|\btsh\b/i', 180],
              ['/vitamin/i', 180], ['/pap/i', 1095], ['/dexa|bone density/i', 730], ['/covid|rt-pcr/i', null]];
    foreach ($rules as [$re, $days]) if (preg_match($re, $testName)) return $days;
    return 365;
}

/** Saves one lab value; the abnormal flag is computed now against the test's range and stored. */
function save_report_value(int $apptId, int $testId, float $value): void {
    $t = db()->prepare('SELECT * FROM tests WHERE id=?'); $t->execute([$testId]);
    $test = $t->fetch() ?: throw new InvalidArgumentException('Unknown test.');
    $lo = $test['normal_range_low'] !== null ? (float)$test['normal_range_low'] : null;
    $hi = $test['normal_range_high'] !== null ? (float)$test['normal_range_high'] : null;
    $abn = ($lo !== null && $value < $lo) || ($hi !== null && $value > $hi);
    db()->prepare('DELETE FROM report_values WHERE appointment_id=? AND test_id=?')->execute([$apptId, $testId]);
    db()->prepare('INSERT INTO report_values (appointment_id,test_id,test_name,category,value,unit,normal_low,normal_high,is_abnormal) VALUES (?,?,?,?,?,?,?,?,?)')
        ->execute([$apptId, $testId, $test['name'], $test['category'], $value, $test['normal_range_unit'], $lo, $hi, $abn ? 1 : 0]);
}

/** Per-test history for one account: [test_name => [[date, value, abnormal, unit, lo, hi], ...]] oldest first. */
function lab_trends(int $userId): array {
    $s = db()->prepare("SELECT rv.test_id, rv.test_name, rv.value, rv.unit, rv.normal_low, rv.normal_high, rv.is_abnormal, a.scheduled_at
        FROM report_values rv JOIN appointments a ON a.id=rv.appointment_id
        WHERE a.patient_id=? AND a.member_id IS NULL ORDER BY a.scheduled_at");
    $s->execute([$userId]);
    $out = [];
    foreach ($s->fetchAll() as $r) $out[$r['test_name']][] = $r;
    return $out;
}

/** Tests due (or soon due) for a retest, based on the last result date. */
function retest_items(int $userId): array {
    $s = db()->prepare("SELECT rv.test_id, rv.test_name, MAX(a.scheduled_at) AS last_at, t.price
        FROM report_values rv JOIN appointments a ON a.id=rv.appointment_id LEFT JOIN tests t ON t.id=rv.test_id
        WHERE a.patient_id=? AND a.member_id IS NULL AND rv.test_id IS NOT NULL GROUP BY rv.test_id, rv.test_name, t.price");
    $s->execute([$userId]);
    $items = [];
    foreach ($s->fetchAll() as $r) {
        $days = retest_interval_days($r['test_name']);
        if ($days === null) continue;
        $due = strtotime($r['last_at']) + $days * 86400;
        $left = (int)floor(($due - time()) / 86400);
        $items[] = $r + ['interval_days' => $days, 'due_at' => date('Y-m-d', $due), 'days_left' => $left,
                         'state' => $left < 0 ? 'OVERDUE' : ($left <= 7 ? 'DUE_SOON' : 'OK')];
    }
    usort($items, fn($a, $b) => $a['days_left'] <=> $b['days_left']);
    return $items;
}

function latest_metric(int $userId, string $metric): ?float {
    if (str_starts_with($metric, 'test:')) {
        $s = db()->prepare('SELECT rv.value FROM report_values rv JOIN appointments a ON a.id=rv.appointment_id WHERE a.patient_id=? AND rv.test_id=? ORDER BY a.scheduled_at DESC LIMIT 1');
        $s->execute([$userId, (int)substr($metric, 5)]);
    } else {
        $s = db()->prepare('SELECT value FROM vital_readings WHERE user_id=? AND member_id IS NULL AND type=? ORDER BY recorded_at DESC LIMIT 1');
        $s->execute([$userId, $metric]);
    }
    $v = $s->fetchColumn();
    return $v === false ? null : (float)$v;
}

/** 0–100 progress from the goal's start value toward its target. */
function goal_progress(array $g, ?float $current): ?int {
    if ($current === null) return null;
    $t = (float)$g['target'];
    $met = $g['direction'] === 'BELOW' ? $current <= $t : $current >= $t;
    if ($met) return 100;
    if ($g['start_value'] === null || (float)$g['start_value'] == $t) return 0;
    $p = ((float)$g['start_value'] - $current) / ((float)$g['start_value'] - $t);
    return (int)max(0, min(99, round($p * 100)));
}

/** Inline SVG sparkline for a list of numbers. */
function sparkline(array $values, int $w = 160, int $h = 40): string {
    if (count($values) < 2) return '';
    $min = min($values); $max = max($values); $range = ($max - $min) ?: 1;
    $pts = [];
    foreach (array_values($values) as $i => $v) $pts[] = round($i * $w / (count($values) - 1), 1) . ',' . round($h - (($v - $min) / $range) * ($h - 6) - 3, 1);
    return '<svg width="' . $w . '" height="' . $h . '" viewBox="0 0 ' . $w . ' ' . $h . '" aria-hidden="true"><polyline fill="none" stroke="#0c9490" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" points="' . implode(' ', $pts) . '"/></svg>';
}

// ---------- Report sharing ----------
function create_share(int $apptId, int $userId, int $days): string {
    $days = max(1, min(30, $days));
    $token = rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');   // 43 chars
    db()->prepare('INSERT INTO report_shares (appointment_id,created_by,token,expires_at) VALUES (?,?,?,DATE_ADD(NOW(), INTERVAL ? DAY))')->execute([$apptId, $userId, $token, $days]);
    return $token;
}

function resolve_share(string $token): ?array {
    if (!preg_match('/^[A-Za-z0-9_-]{43}$/', $token)) return null;
    $s = db()->prepare('SELECT * FROM report_shares WHERE token=? AND revoked_at IS NULL AND expires_at > NOW()');
    $s->execute([$token]);
    return $s->fetch() ?: null;
}

function base_url(): string {
    if ($b = getenv('APP_URL')) return rtrim($b, '/');
    $https = ($_SERVER['HTTPS'] ?? '') === 'on' || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
    return ($https ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost');
}

// ---------- Staff alerts ----------
/** Tells every admin what a technician just did. Never throws, so it can't undo the technician's action. */
function staff_alert(int $agentId, string $kind, string $message, ?string $link = null): void {
    try {
        $admins = db()->query("SELECT id FROM users WHERE role='ADMIN' AND is_active=1")->fetchAll(PDO::FETCH_COLUMN);
        $ins = db()->prepare('INSERT INTO staff_alerts (user_id,agent_id,kind,message,link) VALUES (?,?,?,?,?)');
        foreach ($admins as $a) $ins->execute([$a, $agentId, $kind, mb_substr($message, 0, 300), $link]);
    } catch (Throwable $e) { error_log('staff alert failed: ' . $e->getMessage()); }
}

// ---------- Push (Firebase Cloud Messaging HTTP v1) ----------
/** Sends a push to all of a user's devices. No-op unless FCM_SERVICE_ACCOUNT points at a service-account JSON. */
function push_to_user(int $userId, string $title, string $body): void {
    $path = getenv('FCM_SERVICE_ACCOUNT') ?: '';
    if ($path === '' || !is_readable($path)) return;
    try {
        $sa = json_decode((string)file_get_contents($path), true);
        $token = fcm_access_token($sa);
        if (!$token) return;
        $s = db()->prepare('SELECT token FROM device_tokens WHERE user_id=?'); $s->execute([$userId]);
        foreach ($s->fetchAll(PDO::FETCH_COLUMN) as $dev) {
            $ch = curl_init('https://fcm.googleapis.com/v1/projects/' . rawurlencode($sa['project_id']) . '/messages:send');
            curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_TIMEOUT => 10,
                CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $token, 'Content-Type: application/json'],
                CURLOPT_POSTFIELDS => json_encode(['message' => ['token' => $dev, 'notification' => ['title' => $title, 'body' => $body]]])]);
            curl_exec($ch);
            $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            // 404 = token no longer registered; drop it
            if ($code === 404) db()->prepare('DELETE FROM device_tokens WHERE token=?')->execute([$dev]);
        }
    } catch (Throwable $e) { error_log('push failed: ' . $e->getMessage()); }
}

function fcm_access_token(array $sa): ?string {
    $cache = sys_get_temp_dir() . '/fcm_token_' . md5($sa['client_email'] ?? '') . '.json';
    if (is_readable($cache)) { $c = json_decode((string)file_get_contents($cache), true); if (($c['exp'] ?? 0) > time() + 60) return $c['token']; }
    $b64 = fn($d) => rtrim(strtr(base64_encode($d), '+/', '-_'), '=');
    $now = time();
    $jwt = $b64(json_encode(['alg' => 'RS256', 'typ' => 'JWT'])) . '.' . $b64(json_encode([
        'iss' => $sa['client_email'], 'scope' => 'https://www.googleapis.com/auth/firebase.messaging',
        'aud' => 'https://oauth2.googleapis.com/token', 'iat' => $now, 'exp' => $now + 3600]));
    if (!openssl_sign($jwt, $sig, $sa['private_key'], OPENSSL_ALGO_SHA256)) return null;
    $ch = curl_init('https://oauth2.googleapis.com/token');
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_TIMEOUT => 10,
        CURLOPT_POSTFIELDS => http_build_query(['grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer', 'assertion' => $jwt . '.' . $b64($sig)])]);
    $r = json_decode((string)curl_exec($ch), true); curl_close($ch);
    if (empty($r['access_token'])) return null;
    @file_put_contents($cache, json_encode(['token' => $r['access_token'], 'exp' => $now + (int)($r['expires_in'] ?? 3600)]));
    return $r['access_token'];
}
