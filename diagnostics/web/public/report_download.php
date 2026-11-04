<?php
require __DIR__ . '/../includes/bootstrap.php';
$u = current_user();
if (!$u) redirect('/login.php');
$s = db()->prepare('SELECT r.*, a.patient_id FROM reports r JOIN appointments a ON a.id=r.appointment_id WHERE r.id=?');
$s->execute([(int)($_GET['id'] ?? 0)]);
$r = $s->fetch();
// Only the owning patient or an admin may download
if (!$r || ($u['role'] !== 'ADMIN' && (int)$r['patient_id'] !== (int)$u['id'])) { http_response_code(404); exit('Not found'); }
$path = rtrim(UPLOAD_DIR, '/') . '/' . basename($r['file_name']);
if (!is_file($path)) { http_response_code(404); exit('File missing'); }
header('Content-Type: application/pdf');
header('Content-Disposition: attachment; filename="' . str_replace('"', '', $r['original_name']) . '"');
header('Content-Length: ' . filesize($path));
header('X-Content-Type-Options: nosniff');
readfile($path);
