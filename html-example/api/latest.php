<?php
require_once __DIR__ . '/../includes/bootstrap.php';
$stmt = db()->query('SELECT * FROM meter_readings ORDER BY reading_time DESC LIMIT 1');
$row = $stmt->fetch();
json_response(['data' => $row]);
