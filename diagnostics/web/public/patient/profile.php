<?php
require __DIR__ . '/../../includes/bootstrap.php';
$u = require_role('PATIENT');
$pdo = db();
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    if (($_POST['action'] ?? '') === 'del_passkey') {
        $pdo->prepare('DELETE FROM passkeys WHERE id=? AND user_id=?')->execute([(int)$_POST['id'], $u['id']]);
        flash('Passkey removed.');
        redirect('/patient/profile.php');
    }
    $email = trim($_POST['email'] ?? '') ?: null;
    $phone = empty($u['phone']) ? normalize_phone($_POST['phone'] ?? '') : $u['phone'];   // phone can be set once (Google sign-ups)
    if ($email && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        flash('Enter a valid email.');
    } elseif (empty($u['phone']) && (strlen($phone) < 10 || strlen($phone) > 15)) {
        flash('Enter a valid phone number.');
    } else {
        $dob = ($_POST['dob'] ?? '') ?: null;
        $gender = in_array($_POST['gender'] ?? '', ['M', 'F', 'O'], true) ? $_POST['gender'] : null;
        try {
            $pdo->prepare('UPDATE users SET full_name=?, email=?, phone=?, address=?, dob=?, gender=? WHERE id=?')
                ->execute([trim($_POST['full_name']), $email ? strtolower($email) : null, $phone, trim($_POST['address'] ?? ''), $dob, $gender, $u['id']]);
            if (strlen($_POST['new_password'] ?? '') >= 8) {
                $pdo->prepare('UPDATE users SET password_hash=? WHERE id=?')->execute([password_hash($_POST['new_password'], PASSWORD_DEFAULT), $u['id']]);
            }
            flash('Profile updated.');
        } catch (PDOException $e) { flash('That email or phone is already in use.'); }
    }
    redirect('/patient/profile.php');
}
$pk = $pdo->prepare('SELECT id, label, created_at, last_used_at FROM passkeys WHERE user_id=? ORDER BY id'); $pk->execute([$u['id']]);
render_header('Profile', $u);
?>
<div class="page-header"><div><h1>My profile</h1></div></div>
<form method="post" class="card">
  <?= csrf_field() ?>
  <label>Full name <input name="full_name" value="<?= h($u['full_name']) ?>" required></label>
  <?php if (empty($u['phone'])): ?><label>Phone (needed for bookings) <input name="phone" inputmode="numeric" required></label>
  <?php else: ?><label>Phone <input value="<?= h($u['phone']) ?>" disabled></label><?php endif; ?>
  <label>Email <input type="email" name="email" value="<?= h($u['email']) ?>"></label>
  <label>Date of birth <input type="date" name="dob" value="<?= h($u['dob']) ?>"></label>
  <label>Gender <select name="gender"><option value="">—</option>
    <?php foreach (['M' => 'Male', 'F' => 'Female', 'O' => 'Other'] as $k => $v): ?><option value="<?= $k ?>" <?= $u['gender'] === $k ? 'selected' : '' ?>><?= $v ?></option><?php endforeach; ?></select></label>
  <label>Address <textarea name="address" rows="3"><?= h($u['address']) ?></textarea></label>
  <label>New password (leave blank to keep) <input type="password" name="new_password" minlength="8" autocomplete="new-password"></label>
  <button class="btn">Save</button>
</form>

<div class="card"><h3>Passkeys</h3><p class="page-sub">Sign in with your fingerprint or face lock instead of a password.</p>
<?php foreach ($pk->fetchAll() as $p): ?><div class="job-head" style="padding:6px 0"><span>🔑 <?= h($p['label']) ?> <small>added <?= h(date('d M Y', strtotime($p['created_at']))) ?><?= $p['last_used_at'] ? ' · last used ' . h(date('d M', strtotime($p['last_used_at']))) : '' ?></small></span>
<form method="post"><?= csrf_field() ?><input type="hidden" name="action" value="del_passkey"><input type="hidden" name="id" value="<?= (int)$p['id'] ?>"><button class="btn small danger">Remove</button></form></div><?php endforeach; ?>
<button type="button" class="btn secondary" id="pk-add">Add a passkey on this device</button> <span id="pk-msg" class="page-sub"></span></div>
<script src="/assets/passkey.js"></script>
<script>
document.getElementById('pk-add').onclick = async () => {
  const m = document.getElementById('pk-msg');
  try { await passkeyRegister('<?= h(csrf_token()) ?>', navigator.userAgent.includes('Android') ? 'Android phone' : (navigator.userAgent.includes('iPhone') ? 'iPhone' : 'This device')); location.reload(); }
  catch (e) { m.textContent = e.message || 'Could not add passkey.'; }
};
</script>
<?php render_footer();
