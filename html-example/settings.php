<?php
// settings.php
?>
<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <title>ตั้งค่าไซต์ | Electrical Monitoring</title>
    <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-body: #0d1117; --bg-card: #161b22; --border-color: #30363d;
            --cyan: #22d3ee; --yellow: #facc15; --text: #e6edf3; --dim: #8b949e;
            --green: #2ea043; --danger: #f85149;
        }
        * { box-sizing: border-box; font-family: 'Sarabun', sans-serif; }
        body { background-color: var(--bg-body); color: var(--text); margin: 0; display: flex; height: 100vh; overflow: hidden; }

        /* Sidebar 3.6.1 & 3.6.9.1 */
        .sidebar { width: 260px; background: var(--bg-card); border-right: 1px solid var(--border-color); display: flex; flex-direction: column; padding: 15px; }
        .tor-label { color: var(--yellow); font-size: 11px; margin-bottom: 4px; display: block; font-weight: bold; }
        
        .btn-site-wrapper { margin-bottom: 25px; border: 1px solid #444; border-radius: 8px; padding: 10px; position: relative; }
        .btn-site { background: none; border: 1px solid var(--cyan); color: var(--cyan); width: 100%; padding: 10px; border-radius: 6px; cursor: pointer; font-size: 16px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 10px; }

        .nav-menu { flex-grow: 1; }
        .nav-group { margin-bottom: 20px; padding: 10px; border: 1px solid var(--border-color); border-radius: 8px; position: relative; }
        .nav-item { display: flex; align-items: center; padding: 12px; color: var(--dim); text-decoration: none; border-radius: 6px; margin-bottom: 5px; font-size: 14px; }
        .nav-item:hover { background: rgba(255,255,255,0.05); }
        .nav-item.active { background: rgba(34, 211, 238, 0.1); color: var(--cyan); border-left: 3px solid var(--cyan); }
        .nav-item i { margin-right: 10px; }

        /* Main Layout */
        .main-content { flex-grow: 1; overflow-y: auto; padding: 25px; position: relative; }
        
        /* Header */
        .header { display: flex; justify-content: space-between; margin-bottom: 25px; align-items: flex-start; }
        .site-title { color: var(--cyan); font-size: 22px; margin: 0; }
        .header-right { text-align: right; }
        .sync-status { border: 1px solid var(--cyan); color: var(--cyan); padding: 4px 12px; border-radius: 20px; font-size: 12px; margin-top: 10px; display: inline-block; }

        /* Cards */
        .card { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 12px; padding: 20px; position: relative; margin-bottom: 20px; }
        .card-title { font-size: 16px; font-weight: 600; color: var(--cyan); border-bottom: 1px solid var(--border-color); padding-bottom: 10px; margin-bottom: 15px; }

        /* Form Styles */
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .form-group { margin-bottom: 15px; }
        label { display: block; font-size: 13px; color: var(--dim); margin-bottom: 8px; font-weight: 600; }
        input[type="text"], input[type="number"], select {
            width: 100%; padding: 10px 12px; background: #0d1117; border: 1px solid var(--border-color);
            color: var(--text); border-radius: 6px; font-size: 14px; outline: none; transition: border 0.3s;
        }
        input:focus, select:focus { border-color: var(--cyan); }
        
        .form-help { font-size: 11px; color: var(--dim); margin-top: 5px; }

        /* Buttons */
        .btn-group { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
        .btn { padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600; border: none; }
        .btn-primary { background: var(--cyan); color: #000; }
        .btn-secondary { background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text); }
        .btn:hover { opacity: 0.9; }

        .settings-container { max-width: 900px; margin: 0 auto; }
    </style>
</head>
<body>

    <aside class="sidebar">
        <span class="tor-label"></span>
        <div class="btn-site-wrapper">
            <button class="btn-site">🏠 SITE</button>
        </div>

        <div class="nav-group">
            <span class="tor-label"></span>
            <nav class="nav-menu">
                <a href="index.php"  class="nav-item"><span>📊</span> แดชบอร์ดหลัก</a>
                <a href="sites.php" class="nav-item"><span>🗂️</span> จัดการไซต์</a>
                <a href="reports.php" class="nav-item"><span>📄</span> รายงาน</a>
                <a href="settings.php" class="nav-item active"><span>⚙️</span> ตั้งค่าไซต์</a>
                <a href="sensors.php" class="nav-item"><span>➕</span> เซ็นเซอร์เพิ่มเติม</a>
            </nav>
        </div>
    </aside>

    <main class="main-content">
        <header class="header">
            <div>
                <span class="tor-label"></span>
                <h2 class="site-title">ตั้งค่าไซต์ (Site Settings)</h2>
                <div style="font-size:12px; color:var(--dim); margin-top:5px;">
                    หน้าหลัก / <span style="color:var(--yellow)">ตั้งค่าไซต์</span>
                </div>
            </div>
            <div class="header-right">
                <span class="tor-label"></span>
                <div id="clock">--:--:--</div>
                <div style="font-size:13px; margin-top:5px;">Admin User | สิทธิ์: เต็ม</div>
            </div>
        </header>

        <div class="settings-container">
            <form action="" method="POST">
                <!-- General Settings -->
                <div class="card">
                    <div class="card-title">1. ข้อมูลทั่วไป (General Information)</div>
                    <div class="form-grid">
                        <div class="form-group">
                            <label>รหัสไซต์ (Site ID)</label>
                            <input type="text" value="SITE-03" readonly style="background: rgba(255,255,255,0.05); color: var(--dim); cursor: not-allowed;">
                        </div>
                        <div class="form-group">
                            <label>ชื่อไซต์ (Site Name)</label>
                            <input type="text" name="site_name" value="ตึกปฏิบัติการกลาง" placeholder="เช่น อาคาร A">
                        </div>
                        <div class="form-group">
                            <label>เบอร์ติดต่อฉุกเฉิน</label>
                            <input type="text" name="emergency_contact" value="080-123-4567">
                        </div>
                        <div class="form-group">
                            <label>สถานที่ (Location)</label>
                            <input type="text" name="location" value="กรุงเทพมหานคร">
                        </div>
                    </div>
                </div>

                <!-- Alarm Limits -->
                <div class="card">
                    <div class="card-title">2. ขีดจำกัดการแจ้งเตือน (Alarm & Limit Settings)</div>
                    <div class="form-grid">
                        <div class="form-group">
                            <label>แรงดันไฟฟ้าต่ำสุด (Min Voltage - V)</label>
                            <input type="number" step="0.1" name="min_voltage" value="200.0">
                        </div>
                        <div class="form-group">
                            <label>แรงดันไฟฟ้าสูงสุด (Max Voltage - V)</label>
                            <input type="number" step="0.1" name="max_voltage" value="240.0">
                        </div>
                        <div class="form-group">
                            <label>กระแสไฟฟ้าสูงสุด (Max Current - A)</label>
                            <input type="number" step="0.1" name="max_current" value="40.0">
                        </div>
                        <div class="form-group">
                            <label>กำลังไฟฟ้าใช้งานปกติสูงสุด (Max Power - kW)</label>
                            <input type="number" step="0.1" name="max_power" value="8.0">
                        </div>
                        <div class="form-group" style="grid-column: span 2;">
                            <label>อุณหภูมิเบรกเกอร์สูงสุดวิกฤต (Target Max Temp - °C)</label>
                            <input type="number" step="0.1" name="max_temp" value="50.0" style="border-color: var(--yellow);">
                            <div class="form-help">ระบบจะแจ้งเตือนเมื่ออุณหภูมิเกินกว่าค่าที่ตั้งไว้ (TOR Requirement)</div>
                        </div>
                    </div>
                </div>

                <!-- Notify Config -->
                <div class="card">
                    <div class="card-title">3. การแจ้งเตือนผ่าน Line (Line Notify)</div>
                    <div class="form-group">
                        <label>Line Notify Token</label>
                        <input type="text" name="line_token" value="abc123xyz000..." placeholder="ใส่ซ่อนรหัส Token">
                        <div class="form-help">ออก Token จาก https://notify-bot.line.me/</div>
                    </div>
                    <div class="form-group">
                        <label><input type="checkbox" checked style="width:auto; display:inline;"> เปิดใช้งานการส่งแจ้งเตือนเข้ากลุ่ม Line</label>
                    </div>
                </div>

                <div class="btn-group">
                    <button type="button" class="btn btn-secondary">ยกเลิก</button>
                    <button type="button" class="btn btn-primary" onclick="alert('บันทึกข้อมูลเรียบร้อยแล้ว');">บันทึกข้อมูลตั้งค่า</button>
                </div>
            </form>
        </div>
    </main>

    <script>
        // Update Clock
        function updateClock() {
            const now = new Date();
            document.getElementById('clock').innerText = now.toLocaleString('th-TH');
        }
        setInterval(updateClock, 1000);
        updateClock();
    </script>
</body>
</html>
