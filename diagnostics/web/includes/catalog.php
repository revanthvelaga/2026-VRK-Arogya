<?php
declare(strict_types=1);
// Catalogue, geo and coupon logic ported from Arogya (PostGIS replaced by Haversine).

function haversine_km(float $lat1, float $lng1, float $lat2, float $lng2): float {
    $r = 6371.0;
    $dLat = deg2rad($lat2 - $lat1);
    $dLng = deg2rad($lng2 - $lng1);
    $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;
    return round($r * 2 * asin(min(1, sqrt($a))), 2);
}

/** Active pickup points within $radiusKm of a point, nearest first. */
function nearby_pickup_points(float $lat, float $lng, float $radiusKm = 20): array {
    $rows = db()->query("SELECT pp.*, c.name AS center_name FROM pickup_points pp JOIN centers c ON c.id=pp.center_id WHERE pp.is_active=1 AND c.is_active=1")->fetchAll();
    $out = [];
    foreach ($rows as $r) {
        $d = haversine_km($lat, $lng, (float)$r['latitude'], (float)$r['longitude']);
        if ($d <= $radiusKm) { $r['distance_km_from_you'] = $d; $out[] = $r; }
    }
    usort($out, fn($a, $b) => $a['distance_km_from_you'] <=> $b['distance_km_from_you']);
    return $out;
}

/** Throws unless the point is inside the centre's service radius (Arogya's 20 km rule). */
function distance_within_radius(array $center, float $lat, float $lng): float {
    $d = haversine_km((float)$center['latitude'], (float)$center['longitude'], $lat, $lng);
    if ($d > (float)$center['service_radius_km']) {
        throw new InvalidArgumentException(sprintf('Point is %.1f km from "%s", outside its %s km service radius.', $d, $center['name'], rtrim(rtrim((string)$center['service_radius_km'], '0'), '.')));
    }
    return $d;
}

/**
 * Single source of truth for what a coupon is worth on an order. Used by the
 * checkout preview and again when the booking is created (never trust the preview).
 * Cancelled bookings give their redemption back.
 */
function quote_coupon(string $rawCode, float $subtotal, int $customerId): array {
    $code = strtoupper(trim($rawCode));
    $s = db()->prepare('SELECT * FROM coupons WHERE code=?');
    $s->execute([$code]);
    $c = $s->fetch();
    if (!$c || !$c['is_active']) throw new InvalidArgumentException("\"$code\" isn't a valid offer code.");
    if ($c['valid_until'] && strtotime($c['valid_until']) < time()) throw new InvalidArgumentException("Offer $code has expired.");
    if ($subtotal < (float)$c['min_order']) throw new InvalidArgumentException("$code needs an order of at least ₹" . (float)$c['min_order'] . '.');

    $u = db()->prepare("SELECT COUNT(*) total, COALESCE(SUM(patient_id=?),0) mine FROM appointments WHERE coupon_code=? AND status<>'CANCELLED'");
    $u->execute([$customerId, $code]);
    $use = $u->fetch();
    if ($c['usage_limit'] !== null && (int)$use['total'] >= (int)$c['usage_limit']) throw new InvalidArgumentException("Offer $code has been fully redeemed.");
    if ((int)$use['mine'] >= (int)$c['per_customer_limit']) throw new InvalidArgumentException("You've already used $code.");

    $discount = $c['discount_type'] === 'PERCENT' ? $subtotal * (float)$c['value'] / 100 : (float)$c['value'];
    if ($c['max_discount'] !== null) $discount = min($discount, (float)$c['max_discount']);
    $discount = round(min($discount, $subtotal), 2);
    return ['code' => $code, 'description' => $c['description'], 'discount' => $discount];
}

/** Prices tests and packages server-side from the live catalogue; returns [items, subtotal]. */
function price_items(array $testIds, array $packageIds): array {
    $pdo = db();
    $testIds = array_values(array_unique(array_map('intval', $testIds)));
    $packageIds = array_values(array_unique(array_map('intval', $packageIds)));
    $items = []; $subtotal = 0.0;
    if ($testIds) {
        $in = implode(',', array_fill(0, count($testIds), '?'));
        $s = $pdo->prepare("SELECT id, price FROM tests WHERE is_active=1 AND id IN ($in)");
        $s->execute($testIds);
        $rows = $s->fetchAll();
        if (count($rows) !== count($testIds)) throw new InvalidArgumentException('One of the selected tests is not available.');
        foreach ($rows as $r) { $items[] = ['test_id' => (int)$r['id'], 'package_id' => null, 'price' => (float)$r['price']]; $subtotal += (float)$r['price']; }
    }
    if ($packageIds) {
        $in = implode(',', array_fill(0, count($packageIds), '?'));
        $s = $pdo->prepare("SELECT id, price FROM packages WHERE is_active=1 AND id IN ($in)");
        $s->execute($packageIds);
        $rows = $s->fetchAll();
        if (count($rows) !== count($packageIds)) throw new InvalidArgumentException('One of the selected packages is not available.');
        foreach ($rows as $r) { $items[] = ['test_id' => null, 'package_id' => (int)$r['id'], 'price' => (float)$r['price']]; $subtotal += (float)$r['price']; }
    }
    if (!$items) throw new InvalidArgumentException('Select at least one test or package.');
    return [$items, round($subtotal, 2)];
}
