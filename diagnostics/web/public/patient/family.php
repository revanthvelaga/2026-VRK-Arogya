<?php
require __DIR__ . '/../../includes/bootstrap.php';
$u = require_role('PATIENT');
$pdo = db();
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $a = $_POST['action'] ?? '';
    if ($a === 'add') {
        $name = trim($_POST['full_name'] ?? ''); $rel = trim($_POST['relation'] ?? '');
        $gender = in_array($_POST['gender'] ?? '', ['M', 'F', 'O'], true) ? $_POST['gender'] : null;
        $phone = preg_replace('/\D/', '', $_POST['phone'] ?? '') ?: null;
        if ($name === '' || $rel === '') flash('Name and relation are required.');
        else {
            $pdo->prepare('INSERT INTO family_members (owner_id,full_name,relation,dob,gender,phone) VALUES (?,?,?,?,?,?)')
                ->execute([$u['id'], $name, $rel, ($_POST['dob'] ?? '') ?: null, $gender, $phone]);
            flash("$name added to your family.");
        }
    } elseif ($a === 'remove') {
        // Soft delete: the member may be referenced by past appointments
        $pdo->prepare('UPDATE family_members SET is_active=0 WHERE id=? AND owner_id=?')->execute([(int)$_POST['id'], $u['id']]);
        flash('Family member removed.');
    }
    redirect('/patient/family.php');
}
$s = $pdo->prepare('SELECT * FROM family_members WHERE owner_id=? AND is_active=1 ORDER BY full_name'); $s->execute([$u['id']]);
$members = $s->fetchAll();
render_header('Family', $u);
?>
<div class="page-header"><div><h1>My family</h1><p class="page-sub">Book tests for parents, spouse or children from one account.</p></div></div>
<form method="post" class="card"><?= csrf_field() ?><input type="hidden" name="action" value="add"><h3>Add a family member</h3>
  <div class="grid"><label>Full name <input name="full_name" required></label><label>Relation <input name="relation" placeholder="Mother, Son…" required></label>
  <label>Date of birth <input type="date" name="dob"></label><label>Gender <select name="gender"><option value="">—</option><option value="M">Male</option><option value="F">Female</option><option value="O">Other</option></select></label>
  <label>Phone (optional) <input name="phone"></label></div><button class="btn">Add</button></form>
<?php if (!$members): echo '<div class="card">' . empty_state('users', 'No family members yet.') . '</div>'; else: ?>
<table><tr><th>Name</th><th>Relation</th><th>Age</th><th></th></tr>
<?php foreach ($members as $m): ?><tr><td><?= h($m['full_name']) ?></td><td><?= h($m['relation']) ?></td>
<td><?= $m['dob'] ? (int)((time() - strtotime($m['dob'])) / 31557600) : '—' ?></td>
<td><form method="post" onsubmit="return confirm('Remove this member?')"><?= csrf_field() ?><input type="hidden" name="action" value="remove"><input type="hidden" name="id" value="<?= (int)$m['id'] ?>"><button class="btn small danger">Remove</button></form></td></tr>
<?php endforeach; ?></table><?php endif; ?>
<?php render_footer();
