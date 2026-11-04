<?php
// JSON REST API for the Flutter apps. Auth: "Authorization: Bearer <token>".
declare(strict_types=1);
require __DIR__ . '/../../includes/bootstrap.php';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

function out($data, int $code = 200): never { http_response_code($code); echo json_encode($data, JSON_UNESCAPED_UNICODE); exit; }
function fail(string $msg, int $code = 400): never { out(['error' => $msg], $code); }
function body(): array { $j = json_decode(file_get_contents('php://input') ?: '', true); return is_array($j) ? $j : []; }

function api_user(): array {
    $hdr = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if (!preg_match('/^Bearer\s+([a-f0-9]{64})$/i', $hdr, $m)) fail('Unauthorized', 401);
    $s = db()->prepare('SELECT u.* FROM api_tokens t JOIN users u ON u.id=t.user_id WHERE t.token=? AND t.expires_at>NOW() AND u.is_active=1');
    $s->execute([strtolower($m[1])]);
    return $s->fetch() ?: fail('Unauthorized', 401);
}
function need(array $u, string $role): void { if ($u['role'] !== $role) fail('Forbidden', 403); }
function public_user(array $u): array { return ['id' => (int)$u['id'], 'role' => $u['role'], 'full_name' => $u['full_name'], 'phone' => $u['phone'], 'email' => $u['email'], 'address' => $u['address']]; }
function issue_token(int $uid): string {
    $t = bin2hex(random_bytes(32));
    db()->prepare('INSERT INTO api_tokens (token,user_id,expires_at) VALUES (?,?,DATE_ADD(NOW(), INTERVAL 30 DAY))')->execute([$t, $uid]);
    return $t;
}

$path = trim((string)parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/');
$path = preg_replace('#^api/(index\.php/?)?#', '', $path);
$method = $_SERVER['REQUEST_METHOD'];
try {
    $pdo = db();
    // ---------- Public ----------
    if ($path === 'auth/register' && $method === 'POST') {
        $b = body();
        $name = trim($b['full_name'] ?? ''); $phone = preg_replace('/\D/', '', $b['phone'] ?? '');
        $email = trim($b['email'] ?? '') ?: null; $pass = (string)($b['password'] ?? '');
        if ($name === '' || strlen($phone) < 10 || strlen($phone) > 15) fail('Valid name and phone required');
        if ($email && !filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Invalid email');
        if (strlen($pass) < 8) fail('Password must be at least 8 characters');
        try {
            $pdo->prepare("INSERT INTO users (role,full_name,phone,email,password_hash) VALUES ('PATIENT',?,?,?,?)")->execute([$name, $phone, $email, password_hash($pass, PASSWORD_DEFAULT)]);
        } catch (PDOException $e) { fail('Phone or email already registered', 409); }
        $id = (int)$pdo->lastInsertId();
        $s = $pdo->prepare('SELECT * FROM users WHERE id=?'); $s->execute([$id]);
        out(['token' => issue_token($id), 'user' => public_user($s->fetch())], 201);
    }
    if ($path === 'auth/login' && $method === 'POST') {
        $b = body(); $id = trim($b['identifier'] ?? '');
        $s = $pdo->prepare('SELECT * FROM users WHERE (phone=? OR email=?) AND is_active=1'); $s->execute([$id, $id]);
        $u = $s->fetch();
        if (!$u || !password_verify((string)($b['password'] ?? ''), $u['password_hash'])) fail('Invalid credentials', 401);
        out(['token' => issue_token((int)$u['id']), 'user' => public_user($u)]);
    }

    // ---------- Authenticated ----------
    $u = api_user();

    if ($path === 'me' && $method === 'GET') out(public_user($u));
    if ($path === 'me' && $method === 'PUT') {
        $b = body();
        $pdo->prepare('UPDATE users SET full_name=?, address=? WHERE id=?')->execute([trim($b['full_name'] ?? $u['full_name']) ?: $u['full_name'], $b['address'] ?? $u['address'], $u['id']]);
        $s = $pdo->prepare('SELECT * FROM users WHERE id=?'); $s->execute([$u['id']]);
        out(public_user($s->fetch()));
    }
    if ($path === 'auth/logout' && $method === 'POST') {
        $pdo->prepare('DELETE FROM api_tokens WHERE token=?')->execute([strtolower(substr($_SERVER['HTTP_AUTHORIZATION'] ?? '', 7))]);
        out(['ok' => true]);
    }
    if ($path === 'tests' && $method === 'GET') {
        out($pdo->query('SELECT id, code, name, sample_type, price FROM tests WHERE is_active=1 ORDER BY name')->fetchAll());
    }
    if ($path === 'packages' && $method === 'GET') {
        $pk = $pdo->query('SELECT id, name, description, price, tier FROM packages WHERE is_active=1 ORDER BY price')->fetchAll();
        $tn = [];
        foreach ($pdo->query('SELECT pt.package_id, t.name FROM package_tests pt JOIN tests t ON t.id=pt.test_id')->fetchAll() as $r) $tn[$r['package_id']][] = $r['name'];
        foreach ($pk as &$p) $p['tests'] = $tn[$p['id']] ?? [];
        out($pk);
    }
    if ($path === 'pickup-points' && $method === 'GET') {
        // ?lat=&lng=&radius_km= returns points near the caller (nearest first); otherwise all active points
        if (isset($_GET['lat'], $_GET['lng'])) {
            out(array_map(fn($r) => ['id' => (int)$r['id'], 'name' => $r['name'], 'village_name' => $r['village_name'], 'distance_km' => $r['distance_km_from_you']],
                nearby_pickup_points((float)$_GET['lat'], (float)$_GET['lng'], (float)($_GET['radius_km'] ?? 20))));
        }
        out($pdo->query('SELECT pp.id, pp.name, pp.village_name, pp.distance_km FROM pickup_points pp JOIN centers c ON c.id=pp.center_id WHERE pp.is_active=1 AND c.is_active=1 ORDER BY pp.distance_km')->fetchAll());
    }
    if (preg_match('#^pickup-points/(\d+)/schedule$#', $path, $m) && $method === 'GET') {
        $s = $pdo->prepare('SELECT day_of_week, start_time, end_time FROM pickup_point_schedules WHERE pickup_point_id=? ORDER BY day_of_week, start_time'); $s->execute([$m[1]]);
        out($s->fetchAll());
    }
    if ($path === 'coupons/quote' && $method === 'POST') {
        need($u, 'PATIENT'); $b = body();
        try { out(quote_coupon((string)($b['code'] ?? ''), max(0.0, (float)($b['subtotal'] ?? 0)), (int)$u['id'])); }
        catch (InvalidArgumentException $e) { fail($e->getMessage()); }
    }
    if ($path === 'coupons' && $method === 'GET') {
        out($pdo->query("SELECT code, description FROM coupons WHERE is_active=1 AND (valid_until IS NULL OR valid_until > NOW()) ORDER BY created_at DESC")->fetchAll());
    }
    if ($path === 'notifications' && $method === 'GET') {
        $s = $pdo->prepare('SELECT id,title,body,created_at FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 50'); $s->execute([$u['id']]);
        out($s->fetchAll());
    }

    // ---------- Patient ----------
    if ($path === 'appointments' && $method === 'POST') {
        need($u, 'PATIENT'); $b = body();
        try {
            $id = create_appointment((int)$u['id'], (array)($b['test_ids'] ?? []), (string)($b['scheduled_at'] ?? ''), (string)($b['address'] ?? ''),
                isset($b['latitude']) ? (float)$b['latitude'] : null, isset($b['longitude']) ? (float)$b['longitude'] : null, [
                'package_ids' => (array)($b['package_ids'] ?? []), 'collection_mode' => $b['collection_mode'] ?? 'HOME_VISIT',
                'pickup_point_id' => $b['pickup_point_id'] ?? null, 'coupon_code' => $b['coupon_code'] ?? '']);
        } catch (InvalidArgumentException $e) { fail($e->getMessage()); }
        out(['id' => $id], 201);
    }
    if ($path === 'appointments' && $method === 'GET') {
        need($u, 'PATIENT');
        $s = $pdo->prepare('SELECT id, scheduled_at, status, total_amount, payment_status FROM appointments WHERE patient_id=? ORDER BY scheduled_at DESC'); $s->execute([$u['id']]);
        out($s->fetchAll());
    }
    if (preg_match('#^appointments/(\d+)$#', $path, $m) && $method === 'GET') {
        need($u, 'PATIENT');
        $s = $pdo->prepare('SELECT a.id,a.scheduled_at,a.address,a.status,a.total_amount,a.subtotal,a.discount_amount,a.coupon_code,a.collection_mode,a.payment_status,t.full_name AS technician_name,t.phone AS technician_phone FROM appointments a LEFT JOIN users t ON t.id=a.technician_id WHERE a.id=? AND a.patient_id=?');
        $s->execute([$m[1], $u['id']]);
        $a = $s->fetch() ?: fail('Not found', 404);
        $i = $pdo->prepare('SELECT COALESCE(t.name, pk.name) AS name, i.price FROM appointment_items i LEFT JOIN tests t ON t.id=i.test_id LEFT JOIN packages pk ON pk.id=i.package_id WHERE i.appointment_id=?'); $i->execute([$m[1]]);
        $l = $pdo->prepare('SELECT status, changed_at FROM appointment_status_log WHERE appointment_id=? ORDER BY id'); $l->execute([$m[1]]);
        $r = $pdo->prepare('SELECT id, original_name, uploaded_at FROM reports WHERE appointment_id=? ORDER BY id DESC'); $r->execute([$m[1]]);
        out($a + ['items' => $i->fetchAll(), 'timeline' => $l->fetchAll(), 'reports' => $r->fetchAll()]);
    }
    if (preg_match('#^appointments/(\d+)/cancel$#', $path, $m) && $method === 'POST') {
        need($u, 'PATIENT');
        $s = $pdo->prepare('SELECT status FROM appointments WHERE id=? AND patient_id=?'); $s->execute([$m[1], $u['id']]);
        $st = $s->fetchColumn();
        if (!in_array($st, ['BOOKED', 'ASSIGNED'], true)) fail('Cannot cancel at this stage', 409);
        set_status((int)$m[1], 'CANCELLED', (int)$u['id']);
        out(['ok' => true]);
    }
    if (preg_match('#^reports/(\d+)/download$#', $path, $m) && $method === 'GET') {
        $s = $pdo->prepare('SELECT r.*, a.patient_id FROM reports r JOIN appointments a ON a.id=r.appointment_id WHERE r.id=?'); $s->execute([$m[1]]);
        $r = $s->fetch();
        if (!$r || ($u['role'] !== 'ADMIN' && (int)$r['patient_id'] !== (int)$u['id'])) fail('Not found', 404);
        $file = rtrim(UPLOAD_DIR, '/') . '/' . basename($r['file_name']);
        if (!is_file($file)) fail('File missing', 404);
        header('Content-Type: application/pdf');
        header('Content-Disposition: attachment; filename="' . str_replace('"', '', $r['original_name']) . '"');
        readfile($file); exit;
    }

    // ---------- Payments (Razorpay) ----------
    if ($path === 'payments/order' && $method === 'POST') {
        need($u, 'PATIENT');
        if (RAZORPAY_KEY_ID === '' || RAZORPAY_KEY_SECRET === '') fail('Online payment is not configured. Pay at collection.', 503);
        $b = body();
        $s = $pdo->prepare("SELECT id,total_amount FROM appointments WHERE id=? AND patient_id=? AND payment_status='PENDING' AND status<>'CANCELLED'");
        $s->execute([(int)($b['appointment_id'] ?? 0), $u['id']]);
        $a = $s->fetch() ?: fail('Appointment not payable', 404);
        $ch = curl_init('https://api.razorpay.com/v1/orders');
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_TIMEOUT => 15,
            CURLOPT_USERPWD => RAZORPAY_KEY_ID . ':' . RAZORPAY_KEY_SECRET, CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_POSTFIELDS => json_encode(['amount' => (int)round($a['total_amount'] * 100), 'currency' => 'INR', 'receipt' => 'appt_' . $a['id']])]);
        $resp = json_decode((string)curl_exec($ch), true); curl_close($ch);
        if (empty($resp['id'])) fail('Gateway error', 502);
        $pdo->prepare("INSERT INTO payments (appointment_id,amount,method,gateway_order_id,status) VALUES (?,?, 'ONLINE', ?, 'CREATED')")->execute([$a['id'], $a['total_amount'], $resp['id']]);
        out(['order_id' => $resp['id'], 'amount' => $resp['amount'], 'key_id' => RAZORPAY_KEY_ID]);
    }
    if ($path === 'payments/verify' && $method === 'POST') {
        need($u, 'PATIENT'); $b = body();
        $oid = (string)($b['razorpay_order_id'] ?? ''); $pid = (string)($b['razorpay_payment_id'] ?? '');
        $expected = hash_hmac('sha256', $oid . '|' . $pid, RAZORPAY_KEY_SECRET);
        if (RAZORPAY_KEY_SECRET === '' || !hash_equals($expected, (string)($b['razorpay_signature'] ?? ''))) fail('Signature mismatch', 400);
        $s = $pdo->prepare("SELECT p.id, p.appointment_id, p.amount FROM payments p JOIN appointments a ON a.id=p.appointment_id WHERE p.gateway_order_id=? AND p.status='CREATED' AND a.patient_id=?");
        $s->execute([$oid, $u['id']]);
        $p = $s->fetch() ?: fail('Order not found', 404);
        $receipt = 'RCP' . date('ymd') . str_pad((string)random_int(0, 99999), 5, '0', STR_PAD_LEFT);
        $pdo->prepare("UPDATE payments SET status='PAID', gateway_payment_id=?, receipt_no=?, paid_at=NOW() WHERE id=?")->execute([$pid, $receipt, $p['id']]);
        $pdo->prepare("UPDATE appointments SET payment_status='PAID' WHERE id=?")->execute([$p['appointment_id']]);
        notify((int)$u['id'], 'Payment received', "Receipt $receipt for appointment #{$p['appointment_id']}.");
        out(['receipt_no' => $receipt]);
    }

    // ---------- Technician ----------
    if ($path === 'tech/jobs' && $method === 'GET') {
        need($u, 'TECHNICIAN');
        $s = $pdo->prepare("SELECT a.id,a.scheduled_at,a.address,a.latitude,a.longitude,a.status,p.full_name AS patient_name,p.phone AS patient_phone FROM appointments a JOIN users p ON p.id=a.patient_id WHERE a.technician_id=? AND a.status IN ('ASSIGNED','ON_WAY','SAMPLE_COLLECTED') ORDER BY a.scheduled_at");
        $s->execute([$u['id']]);
        out($s->fetchAll());
    }
    if (preg_match('#^tech/jobs/(\d+)/status$#', $path, $m) && $method === 'POST') {
        need($u, 'TECHNICIAN'); $new = (string)(body()['status'] ?? '');
        $own = $pdo->prepare('SELECT 1 FROM appointments WHERE id=? AND technician_id=?'); $own->execute([$m[1], $u['id']]);
        if (!$own->fetchColumn()) fail('Not found', 404);
        if (!in_array($new, ['ON_WAY', 'SAMPLE_COLLECTED'], true) || !set_status((int)$m[1], $new, (int)$u['id'])) fail('Invalid status change', 409);
        out(['ok' => true]);
    }

    fail('Not found', 404);
} catch (Throwable $e) {
    error_log($e->getMessage());
    fail('Server error', 500);
}
