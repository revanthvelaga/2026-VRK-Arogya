<?php
require __DIR__ . '/../includes/bootstrap.php';
$u = current_user();
if ($u) {
    redirect(['ADMIN' => '/admin/', 'TECHNICIAN' => '/technician/', 'PATIENT' => '/patient/'][$u['role']]);
}
render_header('Welcome', null);
?>
<h1><?= h(APP_NAME) ?></h1>
<p>Book diagnostic tests, track your sample collection, and download reports online.</p>
<p><a class="btn" href="/login.php">Login</a> <a class="btn secondary" href="/register.php">New patient? Register</a></p>
<?php render_footer();
