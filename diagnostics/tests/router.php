<?php
// Router for PHP's built-in server so /api/* reaches the API front controller (Apache uses .htaccess instead).
$p = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$root = __DIR__ . '/../web/public';
if (str_starts_with($p, '/api/') && !is_file($root . $p)) { require $root . '/api/index.php'; return true; }
return false;
