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
echo count($rows) . " appointment reminder(s) sent\n";

// Retest reminders: once per (patient, test, last result date), a week before it is due
$sent = 0;
$patients = $pdo->query("SELECT DISTINCT a.patient_id FROM report_values rv JOIN appointments a ON a.id=rv.appointment_id WHERE a.member_id IS NULL")->fetchAll(PDO::FETCH_COLUMN);
$ins = $pdo->prepare('INSERT IGNORE INTO retest_reminders (user_id,test_id,last_tested_at) VALUES (?,?,?)');
foreach ($patients as $pid) {
    foreach (retest_items((int)$pid) as $it) {
        if ($it['days_left'] > 7) continue;
        $ins->execute([$pid, $it['test_id'], $it['last_at']]);
        if ($ins->rowCount() === 0) continue;   // already reminded for this result
        notify((int)$pid, 'Time for a retest', $it['test_name'] . ' is ' . ($it['days_left'] < 0 ? 'overdue' : 'due on ' . date('d M', strtotime($it['due_at']))) . '. Book it from the app.');
        $sent++;
    }
}
echo "$sent retest reminder(s) sent\n";

// Medicine reminders at 8am / 1pm / 6pm / 9pm (cron runs hourly)
$slot = [8 => 'MORNING', 13 => 'AFTERNOON', 18 => 'EVENING', 21 => 'NIGHT'][(int)date('G')] ?? null;
if ($slot) {
    $m = $pdo->prepare("SELECT user_id, GROUP_CONCAT(name ORDER BY name SEPARATOR ', ') AS names FROM medicines WHERE is_active=1 AND reminder=1 AND FIND_IN_SET(?, timings) GROUP BY user_id");
    $m->execute([$slot]);
    $n = 0;
    foreach ($m->fetchAll() as $r) { push_to_user((int)$r['user_id'], 'Medicine reminder', 'Time to take: ' . $r['names']); $n++; }
    echo "$n medicine reminder(s) sent\n";
}
