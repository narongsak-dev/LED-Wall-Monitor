<?php
require_once __DIR__ . '/../includes/bootstrap.php';

if (current_user()) {
    header('Location: ../index.php');
    exit;
}

$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf();
    $username = trim($_POST['username'] ?? '');
    $password = $_POST['password'] ?? '';

    $stmt = db()->prepare('SELECT id, username, full_name, password_hash, role FROM users WHERE username = ? LIMIT 1');
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    if ($user && password_verify($password, $user['password_hash'])) {
        unset($user['password_hash']);
        $_SESSION['user'] = $user;
        header('Location: ../index.php');
        exit;
    }

    $error = 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
}
?>
<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Login - SITE Monitoring</title>
  <link rel="stylesheet" href="../assets/css/style.css">
</head>
<body class="login-body">
<div class="login-card">
  <div class="login-brand">SITE-03</div>
  <h1>เข้าสู่ระบบ</h1>
  <p class="muted">ระบบติดตามข้อมูลไฟฟ้าแบบเรียลไทม์</p>
  <?php if ($error): ?><div class="alert"><?= e($error) ?></div><?php endif; ?>
  <form method="post">
    <input type="hidden" name="csrf_token" value="<?= e(csrf_token()) ?>">
    <label>Username</label>
    <input type="text" name="username" value="admin" required>
    <label>Password</label>
    <input type="password" name="password" value="Admin@123" required>
    <button type="submit" class="btn-primary w-full">Login</button>
  </form>
  <div class="login-help">ค่าเริ่มต้น: admin / Admin@123</div>
</div>
</body>
</html>
