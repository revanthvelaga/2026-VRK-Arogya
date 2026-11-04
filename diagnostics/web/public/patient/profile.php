<?php
require __DIR__ . '/../../includes/bootstrap.php';
$u = require_role('PATIENT');
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $email = trim($_POST['email'] ?? '') ?: null;
    if ($email && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        flash('Enter a valid email.');
    } else {
        $dob = ($_POST['dob'] ?? '') ?: null;
        $gender = in_array($_POST['gender'] ?? '', ['M', 'F', 'O'], true) ? $_POST['gender'] : null;
        try {
            db()->prepare('UPDATE users SET full_name=?, email=?, address=?, dob=?, gender=? WHERE id=?')
                ->execute([trim($_POST['full_name']), $email, trim($_POST['address'] ?? ''), $dob, $gender, $u['id']]);
            if (strlen($_POST['new_password'] ?? '') >= 8) {
                db()->prepare('UPDATE users SET password_hash=? WHERE id=?')->execute([password_hash($_POST['new_password'], PASSWORD_DEFAULT), $u['id']]);
            }
            flash('Profile updated.');
        } catch (PDOException $e) { flash('That email is already in use.'); }
    }
    redirect('/patient/profile.php');
}
render_header('Profile', $u);
?>
<h1>My Profile</h1>
<form method="post" class="card">
  <?= csrf_field() ?>
  <label>Full name <input name="full_name" value="<?= h($u['full_name']) ?>" required></label>
  <label>Phone <input value="<?= h($u['phone']) ?>" disabled></label>
  <label>Email <input type="email" name="email" value="<?= h($u['email']) ?>"></label>
  <label>Date of birth <input type="date" name="dob" value="<?= h($u['dob']) ?>"></label>
  <label>Gender <select name="gender"><option value="">—</option>
    <?php foreach (['M' => 'Male', 'F' => 'Female', 'O' => 'Other'] as $k => $v): ?><option value="<?= $k ?>" <?= $u['gender'] === $k ? 'selected' : '' ?>><?= $v ?></option><?php endforeach; ?></select></label>
  <label>Address <textarea name="address" rows="3"><?= h($u['address']) ?></textarea></label>
  <label>New password (leave blank to keep) <input type="password" name="new_password" minlength="8"></label>
  <button class="btn">Save</button>
</form>
<?php render_footer();
