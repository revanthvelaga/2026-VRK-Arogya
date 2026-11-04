<?php
require __DIR__ . '/../../includes/bootstrap.php';
$u = require_role('ADMIN');
$pdo = db();
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    if (($_POST['action'] ?? '') === 'create') {
        $name = trim($_POST['full_name'] ?? '');
        $phone = preg_replace('/\D/', '', $_POST['phone'] ?? '');
        $pass = $_POST['password'] ?? '';
        if ($name === '' || strlen($phone) < 10 || strlen($pass) < 8) {
            flash('Name, valid phone and a password of 8+ characters are required.');
        } else {
            try {
                $pdo->prepare("INSERT INTO users (role,full_name,phone,email,password_hash) VALUES ('TECHNICIAN',?,?,?,?)")
                    ->execute([$name, $phone, trim($_POST['email'] ?? '') ?: null, password_hash($pass, PASSWORD_DEFAULT)]);
                flash('Technician added.');
            } catch (PDOException $e) { flash('Phone or email already in use.'); }
        }
    } elseif (($_POST['action'] ?? '') === 'toggle') {
        $pdo->prepare("UPDATE users SET is_active = 1 - is_active WHERE id=? AND role='TECHNICIAN'")->execute([(int)$_POST['id']]);
        flash('Technician updated.');
    }
    redirect('/admin/technicians.php');
}
$techs = $pdo->query("SELECT u.*, (SELECT COUNT(*) FROM appointments a WHERE a.technician_id=u.id AND a.status IN ('ASSIGNED','ON_WAY')) AS open_jobs FROM users u WHERE role='TECHNICIAN' ORDER BY full_name")->fetchAll();
render_header('Technicians', $u);
?>
<h1>Technicians</h1>
<form method="post" class="card"><?= csrf_field() ?><input type="hidden" name="action" value="create">
  <h3>Add technician</h3>
  <div class="grid"><label>Name <input name="full_name" required></label><label>Phone <input name="phone" required></label>
  <label>Email <input type="email" name="email"></label><label>Password <input type="password" name="password" minlength="8" required></label></div>
  <button class="btn">Add</button>
</form>
<table><tr><th>Name</th><th>Phone</th><th>Open jobs</th><th>Active</th><th></th></tr>
<?php foreach ($techs as $t): ?>
<tr><td><?= h($t['full_name']) ?></td><td><?= h($t['phone']) ?></td><td><?= (int)$t['open_jobs'] ?></td><td><?= $t['is_active'] ? 'Yes' : 'No' ?></td>
<td><form method="post"><?= csrf_field() ?><input type="hidden" name="action" value="toggle"><input type="hidden" name="id" value="<?= (int)$t['id'] ?>"><button class="btn small secondary"><?= $t['is_active'] ? 'Disable' : 'Enable' ?></button></form></td></tr>
<?php endforeach; ?></table>
<?php render_footer();
