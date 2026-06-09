<?php
require_once __DIR__ . '/../includes/bootstrap.php';
$metric = $_GET['metric'] ?? 'power';
$range = $_GET['range'] ?? 'realtime';
$allowed = ['voltage','current','power','temperature','energy'];
if (!in_array($metric, $allowed, true)) {
    $metric = 'power';
}

switch ($range) {
    case '24h':
        $interval = '1 DAY';
        $limit = 48;
        break;
    case '7d':
        $interval = '7 DAY';
        $limit = 84;
        break;
    case 'month':
        $interval = '30 DAY';
        $limit = 120;
        break;
    case 'year':
        $interval = '365 DAY';
        $limit = 180;
        break;
    default:
        $interval = '3 HOUR';
        $limit = 36;
}

$sql = "SELECT reading_time, {$metric} AS value FROM meter_readings WHERE reading_time >= NOW() - INTERVAL {$interval} ORDER BY reading_time ASC LIMIT {$limit}";
$rows = db()->query($sql)->fetchAll();
json_response(['metric' => $metric, 'range' => $range, 'data' => $rows]);
