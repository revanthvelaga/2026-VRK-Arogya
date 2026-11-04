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

require_once __DIR__ . '/catalog.php';
require_once __DIR__ . '/rewards.php';

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
    if ($new === 'CANCELLED') {
        // Give back any wallet credit that was spent on this booking
        $w = $pdo->prepare('SELECT wallet_used FROM appointments WHERE id=?'); $w->execute([$apptId]);
        wallet_credit((int)$a['patient_id'], (float)$w->fetchColumn(), 'Refund — appointment cancelled', $apptId);
    }
    notify((int)$a['patient_id'], 'Appointment #' . $apptId, 'Status: ' . STATUS_LABELS[$new]);
    return true;
}

/**
 * Creates an appointment. $opts: package_ids[], collection_mode (HOME_VISIT|PICKUP_POINT|WALK_IN),
 * pickup_point_id, coupon_code. Prices and discounts are always computed server-side.
 */
function create_appointment(int $patientId, array $testIds, string $when, string $address, ?float $lat = null, ?float $lng = null, array $opts = []): int {
    $pdo = db();
    $ts = strtotime($when);
    if (!$ts || $ts < time()) throw new InvalidArgumentException('Choose a future date and time.');

    $mode = $opts['collection_mode'] ?? 'HOME_VISIT';
    if (!in_array($mode, ['HOME_VISIT', 'PICKUP_POINT', 'WALK_IN'], true)) throw new InvalidArgumentException('Invalid collection mode.');
    $pickupId = null;
    if ($mode === 'PICKUP_POINT') {
        $s = $pdo->prepare('SELECT pp.*, c.is_active AS c_active FROM pickup_points pp JOIN centers c ON c.id=pp.center_id WHERE pp.id=? AND pp.is_active=1');
        $s->execute([(int)($opts['pickup_point_id'] ?? 0)]);
        $pp = $s->fetch();
        if (!$pp || !$pp['c_active']) throw new InvalidArgumentException('Pickup point not found.');
        $pickupId = (int)$pp['id'];
        $address = trim($pp['name'] . ($pp['village_name'] ? ', ' . $pp['village_name'] : ''));
        $lat = (float)$pp['latitude']; $lng = (float)$pp['longitude'];
    } elseif ($mode === 'WALK_IN') {
        $address = 'Walk-in at the diagnostic centre';
    } elseif (trim($address) === '') {
        throw new InvalidArgumentException('Address is required for home collection.');
    }

    [$items, $subtotal] = price_items($testIds, (array)($opts['package_ids'] ?? []));
    $coupon = null; $discount = 0.0;
    if (!empty($opts['coupon_code'])) {
        $q = quote_coupon((string)$opts['coupon_code'], $subtotal, $patientId);
        $coupon = $q['code']; $discount = $q['discount'];
    }
    $total = round($subtotal - $discount, 2);

    // Family member the test is for (must belong to this account)
    $memberId = null;
    if (!empty($opts['member_id'])) {
        $m = $pdo->prepare('SELECT id FROM family_members WHERE id=? AND owner_id=? AND is_active=1');
        $m->execute([(int)$opts['member_id'], $patientId]);
        $memberId = $m->fetchColumn() ?: throw new InvalidArgumentException('Family member not found.');
    }
    // Optional wallet credit; what remains is the amount payable
    $walletUsed = 0.0;
    if (!empty($opts['use_wallet'])) {
        $walletUsed = round(min(wallet_balance($patientId), $total), 2);
        $total = round($total - $walletUsed, 2);
    }
    $paidNow = $total <= 0;

    $pdo->beginTransaction();
    try {
        $pdo->prepare('INSERT INTO appointments (patient_id,member_id,scheduled_at,address,latitude,longitude,collection_mode,pickup_point_id,subtotal,discount_amount,coupon_code,wallet_used,total_amount,payment_status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
            ->execute([$patientId, $memberId, date('Y-m-d H:i:00', $ts), $address, $lat, $lng, $mode, $pickupId, $subtotal, $discount, $coupon, $walletUsed, $total, $paidNow ? 'PAID' : 'PENDING']);
        $id = (int)$pdo->lastInsertId();
        if ($walletUsed > 0) wallet_debit($patientId, $walletUsed, "Used on appointment #$id", $id);
        $ins = $pdo->prepare('INSERT INTO appointment_items (appointment_id,test_id,package_id,price) VALUES (?,?,?,?)');
        foreach ($items as $it) $ins->execute([$id, $it['test_id'], $it['package_id'], $it['price']]);
        $pdo->prepare('INSERT INTO appointment_status_log (appointment_id,status,changed_by) VALUES (?,?,?)')->execute([$id, 'BOOKED', $patientId]);
        $pdo->commit();
    } catch (Throwable $e) { $pdo->rollBack(); throw $e; }
    if ($paidNow) reward_referral_if_due($patientId, $id);
    notify($patientId, 'Appointment booked', "Appointment #$id on " . date('d M Y H:i', $ts) . ' is booked. Total ₹' . number_format($total, 2) . ($discount > 0 ? " (saved ₹" . number_format($discount, 2) . " with $coupon)" : '') . ($walletUsed > 0 ? ' — ₹' . number_format($walletUsed, 2) . ' paid from wallet.' : ''));
    return $id;
}

/** Records a paid payment and issues a receipt number. */
function record_payment(int $apptId, float $amount, string $method, ?string $orderId = null, ?string $paymentId = null): string {
    $receipt = 'RCP' . date('ymd') . str_pad((string)random_int(0, 99999), 5, '0', STR_PAD_LEFT);
    $pdo = db();
    $pdo->prepare("INSERT INTO payments (appointment_id,amount,method,gateway_order_id,gateway_payment_id,status,receipt_no,paid_at) VALUES (?,?,?,?,?,'PAID',?,NOW())")
        ->execute([$apptId, $amount, $method, $orderId, $paymentId, $receipt]);
    $pdo->prepare("UPDATE appointments SET payment_status='PAID' WHERE id=?")->execute([$apptId]);
    $pid = $pdo->prepare('SELECT patient_id FROM appointments WHERE id=?'); $pid->execute([$apptId]);
    reward_referral_if_due((int)$pid->fetchColumn(), $apptId);
    return $receipt;
}

function nav_icon(string $name, int $size = 18): string {
    $paths = [
        'grid' => '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
        'cal' => '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
        'flask' => '<path d="M9 3h6M10 3v6L4 19a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-6-10V3"/>',
        'users' => '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
        'chart' => '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
        'plus' => '<circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/>',
        'user' => '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
        'logout' => '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
        'check' => '<path d="M20 6L9 17l-5-5"/>',
        'clock' => '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
        'file' => '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h6"/>',
        'inbox' => '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z"/>',
        'wallet' => '<path d="M20 12V8H6a2 2 0 0 1 0-4h12v4M4 6v12a2 2 0 0 0 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>',
        'truck' => '<path d="M1 3h15v13H1zM16 8h4l3 3v5h-7"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
    ];
    return '<svg width="' . $size . '" height="' . $size . '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' . ($paths[$name] ?? '') . '</svg>';
}

function greeting(): string {
    $h = (int)date('G');
    return $h < 12 ? 'Good morning' : ($h < 17 ? 'Good afternoon' : 'Good evening');
}

function money($v): string { return '₹' . number_format((float)$v, 0); }

/** Courier-style progress tracker, same idea as Arogya's SampleProgress. */
function stepper(string $status): string {
    if ($status === 'CANCELLED') return '<div class="empty-state" style="padding:14px">This appointment was cancelled.</div>';
    $steps = [['BOOKED', 'Booked', 'file'], ['ASSIGNED', 'Technician assigned', 'users'], ['ON_WAY', 'On the way', 'truck'], ['SAMPLE_COLLECTED', 'Sample collected', 'flask'], ['REPORT_READY', 'Report ready', 'check']];
    $cur = array_search($status, array_column($steps, 0), true);
    $out = '<div class="progress-stepper" role="list">';
    foreach ($steps as $i => [$k, $label, $icon]) {
        $state = $i < $cur ? 'done' : ($i === $cur ? 'active' : 'todo');
        if ($status === 'REPORT_READY' && $i === $cur) $state = 'done';
        $out .= '<div class="progress-step progress-step--' . $state . '" role="listitem">' . ($i ? '<div class="progress-connector"></div>' : '')
              . '<div class="progress-dot">' . nav_icon($icon, 14) . '</div><div class="progress-label">' . h($label) . '</div></div>';
    }
    return $out . '</div>';
}

function empty_state(string $icon, string $text): string {
    return '<div class="empty-state"><div class="stat-icon" style="margin:0 auto 10px">' . nav_icon($icon) . '</div>' . h($text) . '</div>';
}

function render_header(string $title, ?array $user = null): void {
    $user = $user ?? current_user();
    $GLOBALS['__shell'] = $user ? 'app' : 'auth';
    $home = ['ADMIN' => '/admin/', 'TECHNICIAN' => '/technician/', 'PATIENT' => '/patient/'][$user['role'] ?? ''] ?? '/';
    echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">';
    echo '<title>' . h($title) . ' — ' . h(APP_NAME) . '</title>';
    echo '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>';
    echo '<link href="https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@600;700&display=swap" rel="stylesheet">';
    echo '<link rel="stylesheet" href="/assets/style.css"></head><body>';
    $mark = '<div class="brand-mark">' . nav_icon('plus') . '</div>';
    if (!$user) {
        echo '<div class="auth-wrap"><a class="sidebar-brand" style="padding:0 0 22px" href="/">' . $mark . '<div class="sidebar-brand-text">' . h(APP_NAME) . '</div></a>';
        if ($m = flash()) echo '<div class="flash">' . h($m) . '</div>';
        return;
    }
    $links = [
        'ADMIN' => [['/admin/', 'Dashboard', 'grid'], ['/admin/appointments.php', 'Appointments', 'cal'], ['/admin/tests.php', 'Tests & Rates', 'flask'], ['/admin/packages.php', 'Packages', 'inbox'], ['/admin/centers.php', 'Centres & Pickups', 'truck'], ['/admin/partner_labs.php', 'Partner Labs', 'users'], ['/admin/coupons.php', 'Offers', 'wallet'], ['/admin/support.php', 'Support', 'inbox'], ['/admin/documents.php', 'Prescriptions', 'file'], ['/admin/technicians.php', 'Technicians', 'users'], ['/admin/reports.php', 'Financials', 'chart']],
        'PATIENT' => [['/patient/', 'My Appointments', 'cal'], ['/patient/book.php', 'Book a Test', 'plus'], ['/patient/family.php', 'Family', 'users'], ['/patient/documents.php', 'Prescriptions', 'file'], ['/patient/support.php', 'Support', 'inbox'], ['/patient/wallet.php', 'Wallet & Refer', 'wallet'], ['/patient/profile.php', 'Profile', 'user']],
        'TECHNICIAN' => [['/technician/', 'My Jobs', 'truck']],
    ][$user['role']] ?? [];
    $cur = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
    echo '<div class="app-shell"><aside class="sidebar"><a class="sidebar-brand" href="' . h($home) . '">' . $mark . '<div class="sidebar-brand-text">' . h(APP_NAME) . '<span>' . h(ucfirst(strtolower($user['role']))) . '</span></div></a>';
    foreach ($links as [$href, $label, $icon]) {
        $active = ($cur === $href || ($href === '/admin/' && $cur === '/admin/index.php') || ($href === '/patient/' && $cur === '/patient/index.php')) ? ' active' : '';
        echo '<a class="nav-link' . $active . '" href="' . h($href) . '">' . nav_icon($icon) . h($label) . '</a>';
    }
    $tabsHtml = '';
    if ($user['role'] === 'PATIENT') {
        foreach (array_filter($links, fn($l) => in_array($l[0], ['/patient/', '/patient/book.php', '/patient/wallet.php', '/patient/profile.php'], true)) as [$href, $label, $icon]) $tabsHtml .= '<a href="' . h($href) . '" class="' . ($cur === $href ? 'on' : '') . '">' . nav_icon($icon, 20) . '<span>' . h(explode(' ', $label)[0] === 'My' ? 'Home' : explode(' ', $label)[0]) . '</span></a>';
        $GLOBALS['__tabs'] = '<nav class="tabbar">' . $tabsHtml . '</nav>';
    }
    echo '<div class="sidebar-footer"><div class="sidebar-user"><b>' . h($user['full_name']) . '</b>' . h($user['phone']) . '</div><a class="nav-link" href="/logout.php">' . nav_icon('logout') . 'Logout</a></div></aside><main class="main">';
    if ($m = flash()) echo '<div class="flash">' . h($m) . '</div>';
}
function render_footer(): void {
    echo (($GLOBALS['__shell'] ?? 'app') === 'auth') ? '</div></body></html>' : '</main></div>' . ($GLOBALS['__tabs'] ?? '') . '</body></html>';
}
