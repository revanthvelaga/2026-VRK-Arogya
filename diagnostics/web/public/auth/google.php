<?php
// Google Identity Services redirect target. Google POSTs `credential` plus a
// `g_csrf_token` that must match the cookie of the same name (double-submit).
require __DIR__ . '/../../includes/bootstrap.php';
if ($_SERVER['REQUEST_METHOD'] !== 'POST' || empty($_POST['credential'])
    || empty($_COOKIE['g_csrf_token']) || !hash_equals($_COOKIE['g_csrf_token'], (string)($_POST['g_csrf_token'] ?? ''))) {
    flash('Google sign-in failed. Please try again.');
    redirect('/login.php');
}
try {
    $id = google_login((string)$_POST['credential']);
    $s = db()->prepare('SELECT phone FROM users WHERE id=?'); $s->execute([$id]);
    if (!$s->fetchColumn()) {
        session_regenerate_id(true);
        $_SESSION['uid'] = $id;
        flash('Welcome! Add your phone number so our technician can reach you.');
        redirect('/patient/profile.php');
    }
    login_user($id);
} catch (InvalidArgumentException $e) {
    flash($e->getMessage());
    redirect('/login.php');
}
