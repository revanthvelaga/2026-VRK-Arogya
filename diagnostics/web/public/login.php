<?php
require __DIR__ . '/../includes/bootstrap.php';
$error = '';
$otpSent = !empty($_SESSION['otp_phone']);
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $a = $_POST['action'] ?? 'password';
    try {
        if ($a === 'password') {
            $s = db()->prepare('SELECT * FROM users WHERE (phone=? OR email=?) AND is_active=1');
            $id = trim($_POST['identifier'] ?? '');
            $s->execute([normalize_phone($id) ?: $id, strtolower($id)]);
            $u = $s->fetch();
            if ($u && password_verify($_POST['password'] ?? '', $u['password_hash'])) login_user((int)$u['id']);
            $error = 'Invalid phone/email or password.';
        } elseif ($a === 'otp_send') {
            otp_send($_POST['phone'] ?? '');
            $_SESSION['otp_phone'] = normalize_phone($_POST['phone']);
            $otpSent = true;
            flash('We sent a 6-digit code to your phone.');
            redirect('/login.php?m=otp');
        } elseif ($a === 'otp_verify') {
            $uid = otp_verify($_SESSION['otp_phone'] ?? '', $_POST['code'] ?? '');
            unset($_SESSION['otp_phone']);
            login_user($uid);
        } elseif ($a === 'otp_reset') {
            unset($_SESSION['otp_phone']);
            redirect('/login.php?m=otp');
        }
    } catch (InvalidArgumentException $e) { $error = $e->getMessage(); }
}
$mode = $_GET['m'] ?? ($_POST['action'] ?? '') ;
$mode = str_starts_with((string)$mode, 'otp') ? 'otp' : 'password';
render_header('Login', null);
?>
<h1>Welcome back</h1>
<p class="page-sub" style="margin-bottom:16px">Sign in to book tests and see your reports.</p>
<?php if ($error): ?><div class="flash err"><?= h($error) ?></div><?php endif; ?>
<div style="display:flex;gap:8px;margin-bottom:12px">
  <a class="btn small <?= $mode === 'password' ? '' : 'secondary' ?>" href="/login.php">Password</a>
  <?php if (SMS_GATEWAY_URL !== ''): ?><a class="btn small <?= $mode === 'otp' ? '' : 'secondary' ?>" href="/login.php?m=otp">Phone OTP</a><?php endif; ?>
</div>
<?php if ($mode === 'otp'): ?>
  <?php if (!$otpSent): ?>
  <form method="post" class="card"><?= csrf_field() ?><input type="hidden" name="action" value="otp_send">
    <label>Phone number <input name="phone" inputmode="numeric" autocomplete="tel" required></label><button class="btn">Send code</button></form>
  <?php else: ?>
  <form method="post" class="card"><?= csrf_field() ?><input type="hidden" name="action" value="otp_verify">
    <p class="page-sub">Code sent to <?= h($_SESSION['otp_phone']) ?></p>
    <label>6-digit code <input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required></label><button class="btn">Verify &amp; sign in</button></form>
  <form method="post"><?= csrf_field() ?><input type="hidden" name="action" value="otp_reset"><button class="btn small secondary">Use a different number</button></form>
  <?php endif; ?>
<?php else: ?>
<form method="post" class="card">
  <?= csrf_field() ?><input type="hidden" name="action" value="password">
  <label>Phone or Email <input name="identifier" autocomplete="username webauthn" required></label>
  <label>Password <input type="password" name="password" autocomplete="current-password" required></label>
  <button class="btn">Login</button>
</form>
<?php endif; ?>

<div class="card" style="display:flex;flex-direction:column;gap:10px;align-items:stretch">
  <button type="button" class="btn secondary" id="pk-login" style="justify-content:center">🔑 Sign in with a passkey (fingerprint / face)</button>
  <div id="pk-msg" class="page-sub"></div>
  <?php if (google_client_id() !== ''): ?>
  <script src="https://accounts.google.com/gsi/client" async></script>
  <div id="g_id_onload" data-client_id="<?= h(google_client_id()) ?>" data-login_uri="<?= h(base_url()) ?>/auth/google.php" data-ux_mode="redirect" data-auto_prompt="false"></div>
  <div class="g_id_signin" data-type="standard" data-text="continue_with" data-shape="pill" data-width="320"></div>
  <?php endif; ?>
</div>
<p>New patient? <a href="/register.php">Register</a></p>
<script src="/assets/passkey.js"></script>
<script>
document.getElementById('pk-login').onclick = async () => {
  const msg = document.getElementById('pk-msg');
  try { const r = await passkeyLogin('<?= h(csrf_token()) ?>'); location.href = r.redirect; }
  catch (e) { msg.textContent = e.message || 'Passkey sign-in failed.'; }
};
</script>
<?php render_footer();
