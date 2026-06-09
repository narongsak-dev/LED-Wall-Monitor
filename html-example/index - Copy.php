<?php
require_once __DIR__ . '/includes/bootstrap.php';
require_login();
$user = current_user();
?>
<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>SITE-03 Dashboard</title>
  <link rel="stylesheet" href="assets/css/style.css">
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
<div class="topbar-lite">
  <div class="topbar-left">Back ← กลับหน้าหลัก</div>
  <div class="topbar-builds"><span>3.6.9.2</span><span>3.6.9.3</span><span>3.6.9.4</span></div>
</div>
<div class="app-shell">
  <aside class="sidebar">
    <div class="sidebar-brand">
      <div class="brand-icon">⌂</div>
      <div>SITE</div>
    </div>
    <div class="nav-card">
      <a class="nav-item active" href="#">แดชบอร์ดหลัก</a>
      <a class="nav-item" href="#report-panel">รายงาน</a>
      <a class="nav-item" href="#">ตั้งค่าไซต์</a>
      <a class="nav-item" href="#">เอ็นเซอร์เพิ่มเติม</a>
    </div>
    <div class="side-version">3.6.1</div>
  </aside>

  <main class="content">
    <header class="header-row">
      <div>
        <div class="site-title">SITE-03 | ตึกปฏิบัติการกลาง</div>
        <div class="overview-line">OVERVIEW</div>
        <div class="sub-meta">หน้าหลัก <span class="badge-green">อัปเดตปกติ</span> <span class="version-chip">3.6.8.2</span></div>
      </div>
      <div class="header-right">
        <div class="datetime-block">
          <div class="date" id="live-date"></div>
          <div class="time" id="live-time"></div>
        </div>
        <div class="user-box">
          <div class="avatar"></div>
          <div>
            <div><?= e($user['full_name']) ?> | สิทธิ์: <?= e($user['role']) ?></div>
            <div class="muted"><a href="auth/logout.php">ออกจากระบบ</a></div>
          </div>
        </div>
      </div>
    </header>

    <div class="status-strip"><span class="dot"></span> สถานะ: เชื่อมต่อ (ข้อมูลล่าสุด: <span id="latest-updated-text">-</span>)</div>

    <section class="grid-main">
      <div class="card panel-left">
        <div class="panel-title-row">
          <div class="panel-title">Real-time Data</div>
          <div class="muted">Updated at 1 นาที</div>
        </div>
        <div class="gauge-grid">
          <div class="gauge-card">
            <div class="metric-label">แรงดันไฟฟ้า <span class="small-code">3.6.5.1</span></div>
            <div class="gauge-wrap"><canvas id="gaugeVoltage" width="260" height="170"></canvas><div class="gauge-value"><span id="voltage-value">228</span><small>V</small></div></div>
            <button class="mini-btn">กราฟย้อนหลัง</button>
          </div>
          <div class="gauge-card">
            <div class="metric-label">กระแสไฟฟ้า <span class="small-code">3.6.5.2</span></div>
            <div class="gauge-wrap"><canvas id="gaugeCurrent" width="260" height="170"></canvas><div class="gauge-value"><span id="current-value">18.5</span><small>A</small></div></div>
            <button class="mini-btn blue">กราฟย้อนหลัง</button>
          </div>
          <div class="gauge-card">
            <div class="metric-label">กำลังไฟฟ้า <span class="small-code">3.6.5.3</span></div>
            <div class="gauge-wrap"><canvas id="gaugePower" width="260" height="170"></canvas><div class="gauge-value"><span id="power-value">4.2</span><small>kW</small></div></div>
            <button class="mini-btn">กราฟย้อนหลัง</button>
          </div>
          <div class="gauge-card">
            <div class="metric-label">อุณหภูมิเบรกเกอร์ <span class="small-code">3.6.5.4</span></div>
            <div class="gauge-wrap"><canvas id="gaugeTemp" width="260" height="170"></canvas><div class="gauge-value"><span id="temp-value">38</span><small>°C</small></div></div>
            <button class="mini-btn yellow">กราฟย้อนหลัง</button>
          </div>
        </div>
      </div>

      <div class="stack-right">
        <div class="card chart-panel">
          <div class="panel-title-row chart-head">
            <div class="panel-title">แนวโน้มข้อมูลไฟฟ้า</div>
            <div class="code-note">3.6.6.2</div>
          </div>
          <div class="chart-controls">
            <div class="select-wrap">
              <label>เลือกข้อมูล</label>
              <select id="metric-select">
                <option value="voltage">Voltage</option>
                <option value="current">Current</option>
                <option value="power" selected>Power</option>
                <option value="temperature">Temperature</option>
                <option value="energy">Energy</option>
              </select>
            </div>
            <div class="range-tabs">
              <button class="range-btn active" data-range="realtime">Real-time</button>
              <button class="range-btn" data-range="24h">24 Hour</button>
              <button class="range-btn" data-range="7d">7 Day</button>
              <button class="range-btn" data-range="month">Month</button>
              <button class="range-btn" data-range="year">Year</button>
            </div>
            <button id="export-btn" class="btn-outline">บันทึกภาพกราฟ</button>
          </div>
          <div class="chart-box">
            <canvas id="trendChart"></canvas>
          </div>
        </div>

        <div class="card report-panel" id="report-panel">
          <div class="panel-title-row">
            <div class="panel-title">Data Report <span class="code-note">3.6.7</span></div>
            <div class="toolbar-inline">
              <input type="date" id="report-date">
              <select id="report-site"><option value="SITE-03">เลือกไซต์</option></select>
              <button class="btn-outline" id="export-csv">Export CSV</button>
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>วันที่/เวลา</th>
                  <th>Site</th>
                  <th>Voltage (V)</th>
                  <th>Current (A)</th>
                  <th>Power (kW)</th>
                  <th>Temp (°C)</th>
                  <th>Energy (kWh)</th>
                </tr>
              </thead>
              <tbody id="report-tbody"></tbody>
            </table>
          </div>
          <div class="pagination-row">
            <div>หน้า <span id="page-label">1</span> จาก <span id="page-total">1</span></div>
            <div>
              <button class="page-btn" id="prev-page">‹</button>
              <button class="page-btn active" id="current-page">1</button>
              <button class="page-btn" id="next-page">›</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  </main>
</div>
<script>
  window.APP_CONFIG = { apiBase: 'api' };
</script>
<script src="assets/js/app.js"></script>
</body>
</html>
