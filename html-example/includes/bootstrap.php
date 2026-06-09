<?php
$config = require __DIR__ . '/../config/app.php';
date_default_timezone_set($config['timezone']);

if (session_status() === PHP_SESSION_NONE) {
    session_name($config['security']['session_name']);
    session_start();
}

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';
