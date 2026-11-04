<?php
// Cron job: run hourly, e.g.  0 * * * * php /var/www/html/bin/send_reminders.php
// Sends a reminder to patients (and assigned technicians) for appointments in the next 24 hours.
require __DIR__ . '/../includes/bootstrap.php';
$pdo = db();
$rows = $pdo->query("SELECT id, patient_id, technician_id, scheduled_at FROM appointments
  WHERE reminder_sent=0 AND status IN ('BOOKED','ASSIGNED')
    AND scheduled_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 24 HOUR)")->fetchAll();
foreach ($rows as $a) {
    $when = date('d M Y H:i', strtotime($a['scheduled_at']));
    notify((int)$a['patient_id'], 'Appointment reminder', "Your appointment #{$a['id']} is scheduled for $when.");
    if ($a['technician_id']) notify((int)$a['technician_id'], 'Job reminder', "Appointment #{$a['id']} is due at $when.");
    $pdo->prepare('UPDATE appointments SET reminder_sent=1 WHERE id=?')->execute([$a['id']]);
}
echo count($rows) . " reminder(s) sent\n";
