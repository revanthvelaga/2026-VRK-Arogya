<?php
require __DIR__ . '/../includes/bootstrap.php';
$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $s = db()->prepare('SELECT * FROM users WHERE (phone=? OR email=?) AND is_active=1');
    $id = trim($_POST['identifier'] ?? '');
    $s->execute([$id, $id]);
    $u = $s->fetch();
    if ($u && password_verify($_POST['password'] ?? '', $u['password_hash'])) {
        session_regenerate_id(true);
        $_SESSION['uid'] = $u['id'];
        redirect(['ADMIN' => '/admin/', 'TECHNICIAN' => '/technician/', 'PATIENT' => '/patient/'][$u['role']]);
    }
    $error = 'Invalid phone/email or password.';
}
render_header('Login', null);
?>
<h1>Login</h1>
<?php if ($error): ?><div class="flash err"><?= h($error) ?></div><?php endif; ?>
<form method="post" class="card">
  <?= csrf_field() ?>
  <label>Phone or Email <input name="identifier" required></label>
  <label>Password <input type="password" name="password" required></label>
  <button class="btn">Login</button>
</form>
<p>New patient? <a href="/register.php">Register</a></p>
<?php render_footer();
