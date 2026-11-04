<?php
require __DIR__ . '/../../includes/bootstrap.php';
$u = require_role('PATIENT');
$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    try {
        $id = create_appointment((int)$u['id'], $_POST['tests'] ?? [], ($_POST['date'] ?? '') . ' ' . ($_POST['time'] ?? ''), $_POST['address'] ?? '');
        flash("Appointment #$id booked.");
        redirect('/patient/appointment.php?id=' . $id);
    } catch (InvalidArgumentException $e) { $error = $e->getMessage(); }
}
$tests = db()->query('SELECT * FROM tests WHERE is_active=1 ORDER BY name')->fetchAll();
render_header('Book Appointment', $u);
?>
<h1>Book Appointment</h1>
<?php if ($error): ?><div class="flash err"><?= h($error) ?></div><?php endif; ?>
<form method="post" class="card">
  <?= csrf_field() ?>
  <h3>Select tests</h3>
  <?php foreach ($tests as $t): ?>
    <label><input type="checkbox" name="tests[]" value="<?= (int)$t['id'] ?>"> <?= h($t['name']) ?> — ₹<?= number_format((float)$t['price'], 2) ?></label>
  <?php endforeach; ?>
  <label>Date <input type="date" name="date" min="<?= date('Y-m-d') ?>" required></label>
  <label>Time <input type="time" name="time" required></label>
  <label>Collection address <textarea name="address" rows="3" required><?= h($u['address'] ?? '') ?></textarea></label>
  <button class="btn">Book</button>
</form>
<?php render_footer();
