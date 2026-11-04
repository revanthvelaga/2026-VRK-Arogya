<?php
require __DIR__ . '/../../includes/bootstrap.php';
$u = require_role('ADMIN');
$period = in_array($_GET['period'] ?? '', ['daily', 'weekly', 'monthly'], true) ? $_GET['period'] : 'daily';
// Group orders and paid revenue by day / ISO week / month
$fmt = ['daily' => '%Y-%m-%d', 'weekly' => '%x-W%v', 'monthly' => '%Y-%m'][$period];
$limit = ['daily' => 30, 'weekly' => 12, 'monthly' => 12][$period];
$q = db()->prepare("SELECT DATE_FORMAT(created_at, ?) AS period,
    COUNT(*) AS orders,
    SUM(status<>'CANCELLED') AS active_orders,
    COALESCE(SUM(CASE WHEN status<>'CANCELLED' THEN total_amount END),0) AS billed,
    COALESCE(SUM(CASE WHEN payment_status='PAID' THEN total_amount END),0) AS collected
  FROM appointments GROUP BY period ORDER BY period DESC LIMIT $limit");
$q->execute([$fmt]);
$rows = $q->fetchAll();

if (($_GET['export'] ?? '') === 'csv') {
    header('Content-Type: text/csv');
    header('Content-Disposition: attachment; filename="report-' . $period . '.csv"');
    $o = fopen('php://output', 'w');
    fputcsv($o, ['Period', 'Orders', 'Active orders', 'Billed', 'Collected']);
    foreach ($rows as $r) fputcsv($o, [$r['period'], $r['orders'], $r['active_orders'], $r['billed'], $r['collected']]);
    exit;
}
render_header('Order & Financial Reports', $u);
?>
<h1>Order &amp; Financial Reports</h1>
<p><?php foreach (['daily', 'weekly', 'monthly'] as $p): ?><a class="btn small <?= $p === $period ? '' : 'secondary' ?>" href="?period=<?= $p ?>"><?= ucfirst($p) ?></a> <?php endforeach; ?>
<a class="btn small secondary" href="?period=<?= h($period) ?>&export=csv">Export CSV</a></p>
<table><tr><th>Period</th><th>Orders</th><th>Active</th><th>Billed</th><th>Collected</th></tr>
<?php foreach ($rows as $r): ?>
<tr><td><?= h($r['period']) ?></td><td><?= (int)$r['orders'] ?></td><td><?= (int)$r['active_orders'] ?></td>
<td>₹<?= number_format((float)$r['billed'], 2) ?></td><td>₹<?= number_format((float)$r['collected'], 2) ?></td></tr>
<?php endforeach; if (!$rows): ?><tr><td colspan="5">No data yet.</td></tr><?php endif; ?></table>
<?php render_footer();
