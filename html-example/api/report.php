<?php
require_once __DIR__ . '/../includes/bootstrap.php';
$page = max(1, (int)($_GET['page'] ?? 1));
$perPage = 10;
$offset = ($page - 1) * $perPage;
$date = $_GET['date'] ?? date('Y-m-d');
$site = $_GET['site'] ?? 'SITE-03';

$countStmt = db()->prepare('SELECT COUNT(*) FROM meter_readings WHERE site_name = ? AND DATE(reading_time) = ?');
$countStmt->execute([$site, $date]);
$total = (int)$countStmt->fetchColumn();
$totalPages = max(1, (int)ceil($total / $perPage));

$stmt = db()->prepare('SELECT reading_time, site_name, voltage, current, power, temperature, energy FROM meter_readings WHERE site_name = ? AND DATE(reading_time) = ? ORDER BY reading_time DESC LIMIT ? OFFSET ?');
$stmt->bindValue(1, $site, PDO::PARAM_STR);
$stmt->bindValue(2, $date, PDO::PARAM_STR);
$stmt->bindValue(3, $perPage, PDO::PARAM_INT);
$stmt->bindValue(4, $offset, PDO::PARAM_INT);
$stmt->execute();
$rows = $stmt->fetchAll();

json_response([
    'page' => $page,
    'total_pages' => $totalPages,
    'rows' => $rows,
]);
