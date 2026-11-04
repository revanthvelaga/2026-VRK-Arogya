<?php
declare(strict_types=1);

// Config from environment (works with Docker and shared hosting alike)
define('DB_HOST', getenv('DB_HOST') ?: '127.0.0.1');
define('DB_NAME', getenv('DB_NAME') ?: 'diagnostics');
define('DB_USER', getenv('DB_USER') ?: 'root');
define('DB_PASS', getenv('DB_PASS') ?: '');
define('APP_NAME', getenv('APP_NAME') ?: 'Diagnostics Centre');
define('UPLOAD_DIR', getenv('UPLOAD_DIR') ?: __DIR__ . '/../storage/reports');
define('RAZORPAY_KEY_ID', getenv('RAZORPAY_KEY_ID') ?: '');
define('RAZORPAY_KEY_SECRET', getenv('RAZORPAY_KEY_SECRET') ?: '');
define('SMS_GATEWAY_URL', getenv('SMS_GATEWAY_URL') ?: '');
define('MAIL_FROM', getenv('MAIL_FROM') ?: 'noreply@example.com');

if (session_status() === PHP_SESSION_NONE) {
    session_set_cookie_params(['httponly' => true, 'samesite' => 'Lax']);
    session_start();
}

function db(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $pdo = new PDO(
            'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
            DB_USER, DB_PASS,
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
             PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
             PDO::ATTR_EMULATE_PREPARES => false]
        );
    }
    return $pdo;
}

function h($v): string { return htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8'); }

function csrf_token(): string {
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(16));
    return $_SESSION['csrf'];
}
function csrf_field(): string { return '<input type="hidden" name="csrf" value="' . h(csrf_token()) . '">'; }
function csrf_check(): void {
    if (!hash_equals($_SESSION['csrf'] ?? '', $_POST['csrf'] ?? '')) {
        http_response_code(400); exit('Invalid request token.');
    }
}

function current_user(): ?array {
    if (empty($_SESSION['uid'])) return null;
    static $u = null;
    if ($u === null) {
        $s = db()->prepare('SELECT * FROM users WHERE id=? AND is_active=1');
        $s->execute([$_SESSION['uid']]);
        $u = $s->fetch() ?: null;
    }
    return $u;
}

function require_role(string $role): array {
    $u = current_user();
    if (!$u || $u['role'] !== $role) { header('Location: /login.php'); exit; }
    return $u;
}

function redirect(string $to): never { header('Location: ' . $to); exit; }

function flash(?string $msg = null): ?string {
    if ($msg !== null) { $_SESSION['flash'] = $msg; return null; }
    $m = $_SESSION['flash'] ?? null; unset($_SESSION['flash']); return $m;
}

const STATUS_LABELS = [
    'BOOKED' => 'Booked', 'ASSIGNED' => 'Technician Assigned', 'ON_WAY' => 'Technician On Way',
    'SAMPLE_COLLECTED' => 'Sample Collected', 'REPORT_READY' => 'Report Ready', 'CANCELLED' => 'Cancelled',
];

// Allowed workflow transitions
const STATUS_FLOW = [
    'BOOKED' => ['ASSIGNED', 'CANCELLED'],
    'ASSIGNED' => ['ON_WAY', 'CANCELLED'],
    'ON_WAY' => ['SAMPLE_COLLECTED'],
    'SAMPLE_COLLECTED' => ['REPORT_READY'],
    'REPORT_READY' => [],
    'CANCELLED' => [],
];

function notify(int $userId, string $title, string $body): void {
    db()->prepare('INSERT INTO notifications (user_id,title,body) VALUES (?,?,?)')->execute([$userId, $title, $body]);
    $s = db()->prepare('SELECT email, phone FROM users WHERE id=?');
    $s->execute([$userId]);
    if ($u = $s->fetch()) {
        if (!empty($u['email'])) {
            @mail($u['email'], $title, $body, 'From: ' . MAIL_FROM);
        }
        if (SMS_GATEWAY_URL !== '') {
            // Generic SMS gateway hook: client supplies URL with {phone} and {text} placeholders
            $url = str_replace(['{phone}', '{text}'], [urlencode($u['phone']), urlencode($title . ': ' . $body)], SMS_GATEWAY_URL);
            @file_get_contents($url);
        }
    }
}

/** Change appointment status, validating workflow and logging + notifying the patient. */
function set_status(int $apptId, string $new, ?int $byUser): bool {
    $pdo = db();
    $s = $pdo->prepare('SELECT status, patient_id FROM appointments WHERE id=?');
    $s->execute([$apptId]);
    $a = $s->fetch();
    if (!$a || !in_array($new, STATUS_FLOW[$a['status']] ?? [], true)) return false;
    $pdo->prepare('UPDATE appointments SET status=? WHERE id=?')->execute([$new, $apptId]);
    $pdo->prepare('INSERT INTO appointment_status_log (appointment_id,status,changed_by) VALUES (?,?,?)')->execute([$apptId, $new, $byUser]);
    notify((int)$a['patient_id'], 'Appointment #' . $apptId, 'Status: ' . STATUS_LABELS[$new]);
    return true;
}

function create_appointment(int $patientId, array $testIds, string $when, string $address, ?float $lat = null, ?float $lng = null): int {
    $pdo = db();
    $testIds = array_values(array_unique(array_map('intval', $testIds)));
    if (!$testIds) throw new InvalidArgumentException('Select at least one test.');
    $ts = strtotime($when);
    if (!$ts || $ts < time()) throw new InvalidArgumentException('Choose a future date and time.');
    if (trim($address) === '') throw new InvalidArgumentException('Address is required.');
    $in = implode(',', array_fill(0, count($testIds), '?'));
    $s = $pdo->prepare("SELECT id, price FROM tests WHERE is_active=1 AND id IN ($in)");
    $s->execute($testIds);
    $rows = $s->fetchAll();
    if (count($rows) !== count($testIds)) throw new InvalidArgumentException('Invalid test selection.');
    $total = array_sum(array_column($rows, 'price'));
    $pdo->beginTransaction();
    try {
        $pdo->prepare('INSERT INTO appointments (patient_id,scheduled_at,address,latitude,longitude,total_amount) VALUES (?,?,?,?,?,?)')
            ->execute([$patientId, date('Y-m-d H:i:00', $ts), $address, $lat, $lng, $total]);
        $id = (int)$pdo->lastInsertId();
        $ins = $pdo->prepare('INSERT INTO appointment_items (appointment_id,test_id,price) VALUES (?,?,?)');
        foreach ($rows as $r) $ins->execute([$id, $r['id'], $r['price']]);
        $pdo->prepare('INSERT INTO appointment_status_log (appointment_id,status,changed_by) VALUES (?,?,?)')->execute([$id, 'BOOKED', $patientId]);
        $pdo->commit();
    } catch (Throwable $e) { $pdo->rollBack(); throw $e; }
    notify($patientId, 'Appointment booked', "Appointment #$id on " . date('d M Y H:i', $ts) . ' is booked. Total ₹' . number_format((float)$total, 2));
    return $id;
}

/** Records a paid payment and issues a receipt number. */
function record_payment(int $apptId, float $amount, string $method, ?string $orderId = null, ?string $paymentId = null): string {
    $receipt = 'RCP' . date('ymd') . str_pad((string)random_int(0, 99999), 5, '0', STR_PAD_LEFT);
    $pdo = db();
    $pdo->prepare("INSERT INTO payments (appointment_id,amount,method,gateway_order_id,gateway_payment_id,status,receipt_no,paid_at) VALUES (?,?,?,?,?,'PAID',?,NOW())")
        ->execute([$apptId, $amount, $method, $orderId, $paymentId, $receipt]);
    $pdo->prepare("UPDATE appointments SET payment_status='PAID' WHERE id=?")->execute([$apptId]);
    return $receipt;
}

function render_header(string $title, ?array $user = null): void {
    $user = $user ?? current_user();
    $home = ['ADMIN' => '/admin/', 'TECHNICIAN' => '/technician/', 'PATIENT' => '/patient/'][$user['role'] ?? ''] ?? '/';
    echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">';
    echo '<title>' . h($title) . ' — ' . h(APP_NAME) . '</title><link rel="stylesheet" href="/assets/style.css"></head><body>';
    echo '<header><a class="brand" href="' . h($home) . '">' . h(APP_NAME) . '</a><nav>';
    if ($user) {
        if ($user['role'] === 'ADMIN') {
            echo '<a href="/admin/appointments.php">Appointments</a><a href="/admin/tests.php">Tests</a><a href="/admin/technicians.php">Technicians</a><a href="/admin/reports.php">Financials</a>';
        } elseif ($user['role'] === 'PATIENT') {
            echo '<a href="/patient/book.php">Book</a><a href="/patient/">My Appointments</a><a href="/patient/profile.php">Profile</a>';
        }
        echo '<a href="/logout.php">Logout (' . h($user['full_name']) . ')</a>';
    }
    echo '</nav></header><main>';
    if ($m = flash()) echo '<div class="flash">' . h($m) . '</div>';
}
function render_footer(): void { echo '</main></body></html>'; }
