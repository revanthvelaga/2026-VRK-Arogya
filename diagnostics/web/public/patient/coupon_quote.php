<?php
// Checkout preview only. The real discount is recomputed in create_appointment().
require __DIR__ . '/../../includes/bootstrap.php';
header('Content-Type: application/json');
$u = require_role('PATIENT');
try {
    // The preview subtotal comes from the client; it is only used for this estimate.
    echo json_encode(quote_coupon((string)($_GET['code'] ?? ''), max(0.0, (float)($_GET['subtotal'] ?? 0)), (int)$u['id']));
} catch (InvalidArgumentException $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
