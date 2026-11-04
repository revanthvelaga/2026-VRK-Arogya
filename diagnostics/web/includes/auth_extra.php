<?php
declare(strict_types=1);
// Extra sign-in methods ported from Arogya: phone OTP, Google, passkeys (WebAuthn).

// ===================== Phone OTP =====================
const OTP_TTL_SECONDS = 300;
const OTP_MAX_SENDS_PER_15_MIN = 3;
const OTP_MAX_ATTEMPTS = 5;

function normalize_phone(string $p): string { return preg_replace('/\D/', '', $p); }

/** Sends a 6-digit code by SMS. Rate-limited per number. Only the hash is stored. */
function otp_send(string $phone): void {
    $phone = normalize_phone($phone);
    if (strlen($phone) < 10 || strlen($phone) > 15) throw new InvalidArgumentException('Enter a valid phone number.');
    if (SMS_GATEWAY_URL === '') throw new InvalidArgumentException('OTP sign-in is not set up yet. Please use your password.');
    $c = db()->prepare('SELECT COUNT(*) FROM otp_challenges WHERE phone=? AND created_at > DATE_SUB(NOW(), INTERVAL 15 MINUTE)');
    $c->execute([$phone]);
    if ((int)$c->fetchColumn() >= OTP_MAX_SENDS_PER_15_MIN) throw new InvalidArgumentException('Too many codes requested. Try again in 15 minutes.');
    $code = (string)random_int(100000, 999999);
    db()->prepare('INSERT INTO otp_challenges (phone,code_hash,expires_at) VALUES (?,?,DATE_ADD(NOW(), INTERVAL ? SECOND))')
        ->execute([$phone, password_hash($code, PASSWORD_DEFAULT), OTP_TTL_SECONDS]);
    $url = str_replace(['{phone}', '{text}'], [urlencode($phone), urlencode("Your " . APP_NAME . " login code is $code. It expires in 5 minutes. Do not share it.")], SMS_GATEWAY_URL);
    $ctx = stream_context_create(['http' => ['timeout' => 10]]);
    if (@file_get_contents($url, false, $ctx) === false) throw new InvalidArgumentException('Could not send the code. Please try again.');
}

/** Returns the user id when the code is right; throws otherwise. */
function otp_verify(string $phone, string $code): int {
    $phone = normalize_phone($phone);
    $pdo = db();
    $s = $pdo->prepare('SELECT * FROM otp_challenges WHERE phone=? AND consumed_at IS NULL AND expires_at > NOW() ORDER BY id DESC LIMIT 1');
    $s->execute([$phone]);
    $ch = $s->fetch();
    if (!$ch) throw new InvalidArgumentException('The code has expired. Request a new one.');
    if ((int)$ch['attempts'] >= OTP_MAX_ATTEMPTS) throw new InvalidArgumentException('Too many wrong attempts. Request a new code.');
    $pdo->prepare('UPDATE otp_challenges SET attempts = attempts + 1 WHERE id=?')->execute([$ch['id']]);
    if (!password_verify(trim($code), $ch['code_hash'])) throw new InvalidArgumentException('That code is not correct.');
    $pdo->prepare('UPDATE otp_challenges SET consumed_at=NOW() WHERE id=?')->execute([$ch['id']]);
    $u = $pdo->prepare('SELECT id FROM users WHERE phone=? AND is_active=1'); $u->execute([$phone]);
    $uid = $u->fetchColumn();
    if (!$uid) throw new InvalidArgumentException('No account uses this number yet. Please register first.');
    return (int)$uid;
}

// ===================== Google sign-in =====================
function google_client_id(): string { return getenv('GOOGLE_CLIENT_ID') ?: ''; }

/** Verifies a Google ID token and returns the matching (or new patient) user id. */
function google_login(string $idToken): int {
    $cid = google_client_id();
    if ($cid === '') throw new InvalidArgumentException('Google sign-in is not set up.');
    $ch = curl_init('https://oauth2.googleapis.com/tokeninfo?id_token=' . urlencode($idToken));
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10]);
    $info = json_decode((string)curl_exec($ch), true);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($code !== 200 || !is_array($info)) throw new InvalidArgumentException('Google sign-in failed. Please try again.');
    if (($info['aud'] ?? '') !== $cid || !in_array($info['iss'] ?? '', ['accounts.google.com', 'https://accounts.google.com'], true)
        || (int)($info['exp'] ?? 0) < time() || !filter_var($info['email_verified'] ?? false, FILTER_VALIDATE_BOOLEAN) || empty($info['sub'])) {
        throw new InvalidArgumentException('Google sign-in could not be verified.');
    }
    $pdo = db();
    $s = $pdo->prepare('SELECT id, is_active FROM users WHERE google_sub=?'); $s->execute([$info['sub']]);
    if ($u = $s->fetch()) { if (!$u['is_active']) throw new InvalidArgumentException('This account is disabled.'); return (int)$u['id']; }
    $s = $pdo->prepare('SELECT id, is_active FROM users WHERE email=?'); $s->execute([strtolower($info['email'])]);
    if ($u = $s->fetch()) {
        if (!$u['is_active']) throw new InvalidArgumentException('This account is disabled.');
        $pdo->prepare('UPDATE users SET google_sub=? WHERE id=?')->execute([$info['sub'], $u['id']]);
        return (int)$u['id'];
    }
    // New patient; they add a phone number before their first booking
    $pdo->prepare("INSERT INTO users (role,full_name,email,google_sub,password_hash) VALUES ('PATIENT',?,?,?,?)")
        ->execute([mb_substr($info['name'] ?? explode('@', $info['email'])[0], 0, 150), strtolower($info['email']), $info['sub'], password_hash(bin2hex(random_bytes(16)), PASSWORD_DEFAULT)]);
    $id = (int)$pdo->lastInsertId();
    ensure_referral_code($id);
    return $id;
}

// ===================== Passkeys (WebAuthn) =====================
// Minimal relying-party verifier: "none" attestation trust, ES256 and RS256 keys.

function b64url_enc(string $d): string { return rtrim(strtr(base64_encode($d), '+/', '-_'), '='); }
function b64url_dec(string $d): string { return (string)base64_decode(strtr($d, '-_', '+/') . str_repeat('=', (4 - strlen($d) % 4) % 4)); }

function webauthn_origin(): string { return base_url(); }
function webauthn_rp_id(): string { return (string)parse_url(webauthn_origin(), PHP_URL_HOST); }

/** Decodes one CBOR item starting at $pos (advances $pos). Supports the subset WebAuthn uses. */
function cbor_decode(string $b, int &$pos) {
    if ($pos >= strlen($b)) throw new InvalidArgumentException('Bad CBOR');
    $ib = ord($b[$pos++]); $mt = $ib >> 5; $ai = $ib & 31;
    $len = function () use ($b, &$pos, $ai): int {
        if ($ai < 24) return $ai;
        $n = [24 => 1, 25 => 2, 26 => 4, 27 => 8][$ai] ?? throw new InvalidArgumentException('Bad CBOR length');
        $v = 0; for ($i = 0; $i < $n; $i++) $v = ($v << 8) | ord($b[$pos++]);
        return $v;
    };
    switch ($mt) {
        case 0: return $len();
        case 1: return -1 - $len();
        case 2: case 3: $n = $len(); $s = substr($b, $pos, $n); $pos += $n; return $s;
        case 4: $n = $len(); $a = []; for ($i = 0; $i < $n; $i++) $a[] = cbor_decode($b, $pos); return $a;
        case 5: $n = $len(); $m = []; for ($i = 0; $i < $n; $i++) { $k = cbor_decode($b, $pos); $m[$k] = cbor_decode($b, $pos); } return $m;
        case 7: if ($ai === 20) return false; if ($ai === 21) return true; if ($ai === 22) return null; break;
    }
    throw new InvalidArgumentException('Unsupported CBOR');
}

function der_len(int $n): string { if ($n < 128) return chr($n); $s = ltrim(pack('N', $n), "\0"); return chr(0x80 | strlen($s)) . $s; }
function der(int $tag, string $v): string { return chr($tag) . der_len(strlen($v)) . $v; }
function der_uint(string $bytes): string { $bytes = ltrim($bytes, "\0"); if ($bytes === '' || ord($bytes[0]) & 0x80) $bytes = "\0" . $bytes; return der(0x02, $bytes); }

/** COSE public key map -> PEM SubjectPublicKeyInfo. */
function cose_to_pem(array $k): string {
    if (($k[1] ?? null) === 2 && ($k[3] ?? null) === -7 && ($k[-1] ?? null) === 1 && strlen($k[-2] ?? '') === 32 && strlen($k[-3] ?? '') === 32) {
        $der = hex2bin('3059301306072a8648ce3d020106082a8648ce3d030107034200') . "\x04" . $k[-2] . $k[-3];
    } elseif (($k[1] ?? null) === 3 && ($k[3] ?? null) === -257 && isset($k[-1], $k[-2])) {
        $rsa = der(0x30, der_uint($k[-1]) . der_uint($k[-2]));
        $der = der(0x30, hex2bin('300d06092a864886f70d0101010500') . der(0x03, "\0" . $rsa));
    } else {
        throw new InvalidArgumentException('Unsupported passkey type.');
    }
    return "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($der), 64, "\n") . "-----END PUBLIC KEY-----\n";
}

function webauthn_check_client_data(string $cdj, string $type, string $challenge, string $origin): void {
    $cd = json_decode($cdj, true);
    if (!is_array($cd) || ($cd['type'] ?? '') !== $type) throw new InvalidArgumentException('Passkey response type mismatch.');
    if (!hash_equals(b64url_enc($challenge), (string)($cd['challenge'] ?? ''))) throw new InvalidArgumentException('Passkey challenge mismatch.');
    if (($cd['origin'] ?? '') !== $origin) throw new InvalidArgumentException('Passkey origin mismatch.');
}

/** Parses authenticator data; checks the RP id hash and user-presence flag. */
function webauthn_parse_auth_data(string $ad, string $rpId): array {
    if (strlen($ad) < 37) throw new InvalidArgumentException('Bad authenticator data.');
    if (!hash_equals(hash('sha256', $rpId, true), substr($ad, 0, 32))) throw new InvalidArgumentException('Passkey is for a different site.');
    $flags = ord($ad[32]);
    if (!($flags & 0x01)) throw new InvalidArgumentException('User presence was not confirmed.');
    $out = ['flags' => $flags, 'sign_count' => unpack('N', substr($ad, 33, 4))[1]];
    if ($flags & 0x40) {   // attested credential data present
        $credLen = unpack('n', substr($ad, 53, 2))[1];
        $out['credential_id'] = substr($ad, 55, $credLen);
        $pos = 55 + $credLen;
        $out['cose'] = cbor_decode($ad, $pos);
    }
    return $out;
}

/** Verifies a registration response; returns [credential_id (raw), public_key_pem, sign_count]. */
function webauthn_verify_registration(string $clientDataJSON, string $attestationObject, string $challenge, string $origin, string $rpId): array {
    webauthn_check_client_data($clientDataJSON, 'webauthn.create', $challenge, $origin);
    $pos = 0;
    $att = cbor_decode($attestationObject, $pos);
    if (!is_array($att) || !isset($att['authData'])) throw new InvalidArgumentException('Bad attestation.');
    $ad = webauthn_parse_auth_data($att['authData'], $rpId);
    if (empty($ad['credential_id']) || !is_array($ad['cose'] ?? null)) throw new InvalidArgumentException('No credential in response.');
    return [$ad['credential_id'], cose_to_pem($ad['cose']), $ad['sign_count']];
}

/** Verifies a login assertion against a stored key; returns the new sign count. */
function webauthn_verify_assertion(string $clientDataJSON, string $authenticatorData, string $signature, string $pem, int $storedCount, string $challenge, string $origin, string $rpId): int {
    webauthn_check_client_data($clientDataJSON, 'webauthn.get', $challenge, $origin);
    $ad = webauthn_parse_auth_data($authenticatorData, $rpId);
    $ok = openssl_verify($authenticatorData . hash('sha256', $clientDataJSON, true), $signature, $pem, OPENSSL_ALGO_SHA256);
    if ($ok !== 1) throw new InvalidArgumentException('Passkey signature is not valid.');
    // A counter that goes backwards suggests a cloned key (many passkeys always send 0)
    if ($storedCount > 0 && $ad['sign_count'] <= $storedCount) throw new InvalidArgumentException('Passkey counter check failed.');
    return $ad['sign_count'];
}
