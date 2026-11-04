<?php
// Authenticated download of an uploaded document. Owner or admin only.
require __DIR__ . '/../includes/bootstrap.php';
$u = current_user();
if (!$u) redirect('/login.php');
$s = db()->prepare('SELECT * FROM documents WHERE id=?');
$s->execute([(int)($_GET['id'] ?? 0)]);
$d = $s->fetch();
if (!$d || ($u['role'] !== 'ADMIN' && (int)$d['user_id'] !== (int)$u['id'])) { http_response_code(404); exit('Not found'); }
$dir = getenv('DOC_DIR') ?: dirname(UPLOAD_DIR) . '/documents';
$path = $dir . '/' . basename($d['file_name']);
if (!is_file($path)) { http_response_code(404); exit('File missing'); }
header('Content-Type: ' . $d['mime']);
header('Content-Disposition: inline; filename="' . str_replace('"', '', $d['original_name']) . '"');
header('Content-Length: ' . filesize($path));
header('X-Content-Type-Options: nosniff');
header("Content-Security-Policy: default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'");
readfile($path);
