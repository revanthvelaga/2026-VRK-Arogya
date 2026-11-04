<?php
// JSON endpoints for passkey registration (signed-in users) and passkey sign-in.
require __DIR__ . '/../../includes/bootstrap.php';
header('Content-Type: application/json');
function jout($d, int $c = 200): never { http_response_code($c); echo json_encode($d); exit; }

if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !hash_equals(csrf_token(), $_SERVER['HTTP_X_CSRF'] ?? '')) jout(['error' => 'Invalid request'], 400);
$body = json_decode(file_get_contents('php://input') ?: '{}', true) ?: [];
$action = $_GET['action'] ?? '';
$pdo = db();
$origin = webauthn_origin(); $rpId = webauthn_rp_id();

try {
    if ($action === 'register_options') {
        $u = current_user() ?: jout(['error' => 'Please sign in first'], 401);
        $_SESSION['wa_reg'] = random_bytes(32);
        $ex = $pdo->prepare('SELECT credential_id FROM passkeys WHERE user_id=?'); $ex->execute([$u['id']]);
        jout(['challenge' => b64url_enc($_SESSION['wa_reg']), 'rp' => ['name' => APP_NAME, 'id' => $rpId],
              'user' => ['id' => b64url_enc(pack('N', (int)$u['id'])), 'name' => $u['phone'] ?: $u['email'], 'displayName' => $u['full_name']],
              'exclude' => array_map('b64url_enc', $ex->fetchAll(PDO::FETCH_COLUMN))]);
    }
    if ($action === 'register_verify') {
        $u = current_user() ?: jout(['error' => 'Please sign in first'], 401);
        $chal = $_SESSION['wa_reg'] ?? null; unset($_SESSION['wa_reg']);
        if (!$chal) jout(['error' => 'Start again'], 400);
        [$cid, $pem, $count] = webauthn_verify_registration(b64url_dec((string)($body['clientDataJSON'] ?? '')), b64url_dec((string)($body['attestationObject'] ?? '')), $chal, $origin, $rpId);
        $pdo->prepare('INSERT INTO passkeys (user_id,credential_id,public_key,sign_count,label) VALUES (?,?,?,?,?)')
            ->execute([$u['id'], $cid, $pem, $count, mb_substr(trim((string)($body['label'] ?? '')), 0, 80) ?: 'Passkey']);
        jout(['ok' => true]);
    }
    if ($action === 'login_options') {
        $_SESSION['wa_login'] = random_bytes(32);
        jout(['challenge' => b64url_enc($_SESSION['wa_login']), 'rpId' => $rpId]);
    }
    if ($action === 'login_verify') {
        $chal = $_SESSION['wa_login'] ?? null; unset($_SESSION['wa_login']);
        if (!$chal) jout(['error' => 'Start again'], 400);
        $s = $pdo->prepare('SELECT p.*, u.role, u.is_active FROM passkeys p JOIN users u ON u.id=p.user_id WHERE p.credential_id=?');
        $s->execute([b64url_dec((string)($body['id'] ?? ''))]);
        $pk = $s->fetch();
        if (!$pk || !$pk['is_active']) jout(['error' => 'This passkey is not registered here. Sign in with your password, then add a passkey in Profile.'], 400);
        $count = webauthn_verify_assertion(b64url_dec((string)($body['clientDataJSON'] ?? '')), b64url_dec((string)($body['authenticatorData'] ?? '')),
            b64url_dec((string)($body['signature'] ?? '')), $pk['public_key'], (int)$pk['sign_count'], $chal, $origin, $rpId);
        $pdo->prepare('UPDATE passkeys SET sign_count=?, last_used_at=NOW() WHERE id=?')->execute([$count, $pk['id']]);
        session_regenerate_id(true);
        $_SESSION['uid'] = (int)$pk['user_id'];
        jout(['ok' => true, 'redirect' => home_for($pk['role'])]);
    }
    jout(['error' => 'Unknown action'], 404);
} catch (InvalidArgumentException $e) {
    jout(['error' => $e->getMessage()], 400);
}
