<?php
require_once __DIR__ . '/../includes/bootstrap.php';
session_destroy();
header('Location: login.php');
exit;
