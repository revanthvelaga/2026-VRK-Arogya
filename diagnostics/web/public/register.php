<?php
require __DIR__ . '/../includes/bootstrap.php';
$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $name = trim($_POST['full_name'] ?? '');
    $phone = preg_replace('/\D/', '', $_POST['phone'] ?? '');
    $email = trim($_POST['email'] ?? '') ?: null;
    $pass = $_POST['password'] ?? '';
    if ($name === '' || strlen($phone) < 10 || strlen($phone) > 15) $error = 'Enter your name and a valid phone number.';
    elseif ($email && !filter_var($email, FILTER_VALIDATE_EMAIL)) $error = 'Enter a valid email.';
    elseif (strlen($pass) < 8) $error = 'Password must be at least 8 characters.';
    else {
        try {
            db()->prepare("INSERT INTO users (role,full_name,phone,email,password_hash) VALUES ('PATIENT',?,?,?,?)")
                ->execute([$name, $phone, $email, password_hash($pass, PASSWORD_DEFAULT)]);
            $newId = (int)db()->lastInsertId();
            ensure_referral_code($newId);
            if (trim($_POST['referral'] ?? '') !== '') {
                try { apply_referral($newId, $_POST['referral']); } catch (InvalidArgumentException $e) { /* bad code must not block sign-up */ }
            }
            flash('Registration successful. Please login.');
            redirect('/login.php');
        } catch (PDOException $e) {
            $error = $e->getCode() === '23000' ? 'Phone or email already registered.' : 'Could not register.';
        }
    }
}
render_header('Register', null);
?>
<h1>Patient Registration</h1>
<?php if ($error): ?><div class="flash err"><?= h($error) ?></div><?php endif; ?>
<form method="post" class="card">
  <?= csrf_field() ?>
  <label>Full name <input name="full_name" required></label>
  <label>Phone <input name="phone" required></label>
  <label>Email (optional) <input type="email" name="email"></label>
  <label>Password <input type="password" name="password" minlength="8" required></label>
  <label>Referral code (optional) <input name="referral" style="text-transform:uppercase"></label>
  <button class="btn">Register</button>
</form>
<?php render_footer();
