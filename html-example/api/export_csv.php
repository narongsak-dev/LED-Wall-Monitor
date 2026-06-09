<?php
require_once __DIR__ . '/../includes/bootstrap.php';
$date = $_GET['date'] ?? date('Y-m-d');
$site = $_GET['site'] ?? 'SITE-03';
$stmt = db()->prepare('SELECT reading_time, site_name, voltage, current, power, temperature, energy FROM meter_readings WHERE site_name = ? AND DATE(reading_time) = ? ORDER BY reading_time DESC');
$stmt->execute([$site, $date]);
$rows = $stmt->fetchAll();

header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename=report_' . $site . '_' . $date . '.csv');
$out = fopen('php://output', 'w');
fputcsv($out, ['DateTime', 'Site', 'Voltage', 'Current', 'Power', 'Temp', 'Energy']);
foreach ($rows as $row) {
    fputcsv($out, $row);
}
fclose($out);
exit;
