<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <title>Electrical Monitoring | 100% TOR Matching</title>
    <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        :root {
            --bg-body: #0d1117; --bg-card: #161b22; --border-color: #30363d;
            --cyan: #22d3ee; --yellow: #facc15; --text: #e6edf3; --dim: #8b949e;
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
        .nav-item.active { background: rgba(34, 211, 238, 0.1); color: var(--cyan); border-left: 3px solid var(--cyan); }
        .nav-item i { margin-right: 10px; }
        .sub-item { padding-left: 35px; color: var(--dim); font-size: 13px; text-decoration: none; display: block; margin-top: 8px; }

        /* Main Layout */
        .main-content { flex-grow: 1; overflow-y: auto; padding: 25px; position: relative; }
        
        /* Header 3.6.9 */
        .header { display: flex; justify-content: space-between; margin-bottom: 25px; align-items: flex-start; }
        .site-title { color: var(--cyan); font-size: 22px; margin: 0; }
        .header-right { text-align: right; }
        .sync-status { border: 1px solid var(--cyan); color: var(--cyan); padding: 4px 12px; border-radius: 20px; font-size: 12px; margin-top: 10px; display: inline-block; }

        /* Grid System */
        .grid { display: grid; grid-template-columns: 1fr 1.6fr; gap: 20px; }
        .card { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 12px; padding: 20px; position: relative; }

        /* Gauges 3.6.5 */
        .gauge-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .gauge-box { border: 1px solid var(--border-color); border-radius: 12px; padding: 15px; text-align: center; position: relative; }
        .gauge-wrapper { width: 130px; height: 130px; margin: 0 auto; position: relative; }
        .gauge-val-text { position: absolute; top: 55%; left: 50%; transform: translate(-50%, -50%); text-align: center; }
        .val-num { font-size: 24px; font-weight: bold; color: var(--cyan); }
        .val-unit { font-size: 12px; color: var(--dim); }

        /* Table 3.6.7 */
        .table-section { margin-top: 20px; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 10px; }
        th { text-align: left; color: var(--dim); padding: 12px; border-bottom: 1px solid var(--border-color); }
        td { padding: 12px; border-bottom: 1px solid var(--border-color); }

        /* Buttons */
        .btn-capture { background: var(--cyan); color: #000; border: none; padding: 6px 15px; border-radius: 6px; font-weight: 600; font-size: 12px; cursor: pointer; }
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
                <a href="index.php"  class="nav-item active"><span>📊</span> แดชบอร์ดหลัก</a>
                <a href="sites.php" class="nav-item"><span>🗂️</span> จัดการไซต์</a>
                <a href="reports.php" class="nav-item"><span>📄</span> รายงาน</a>
                <a href="settings.php" class="nav-item"><span>⚙️</span> ตั้งค่าไซต์</a>
                <a href="sensors.php" class="nav-item"><span>➕</span> เซ็นเซอร์เพิ่มเติม</a>
            </nav>
        </div>
    </aside>

    <main class="main-content">
        <header class="header">
            <div>
                <span class="tor-label"></span>
                <h2 class="site-title">SITE-03 | ตึกปฏิบัติการกลาง</h2>
                <div style="font-size:12px; color:var(--dim); margin-top:5px;">
                    หน้าหลัก / <span class="tor-label" style="display:inline"></span> <span style="color:var(--yellow)">ดูข้อมูลไซต์</span>
                </div>
            </div>
            <div class="header-right">
                <span class="tor-label"></span>
                <div id="clock">--:--:--</div>
                <span class="tor-label"></span>
                <div style="font-size:13px;">Admin User | สิทธิ์: เต็ม</div>
                <span class="tor-label"></span><br>
                <div class="sync-status" id="sync-time">● สถานะ: เชื่อมต่อ (13:12:54)</div>
            </div>
        </header>

        <div class="grid">
            <section class="card">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                    <span class="card-title">Real-time Data</span>
                    <span class="tor-label"></span>
                </div>
                <div class="gauge-grid">
                    <div class="gauge-box">
                        <span class="tor-label" style="position:absolute; top:5px; right:10px;"></span>
                        <div style="font-size:12px; color:var(--dim);">แรงดันไฟฟ้า</div>
                        <div class="gauge-wrapper"><canvas id="gV"></canvas><div class="gauge-val-text"><span class="val-num" id="vTxt">0</span><br><span class="val-unit">V</span></div></div>
                        <button style="background:#1f2937; border:1px solid #333; color:var(--dim); font-size:10px; padding:3px 8px; border-radius:4px;">กราฟย้อนหลัง</button>
                    </div>
                    <div class="gauge-box">
                        <span class="tor-label" style="position:absolute; top:5px; right:10px;"></span>
                        <div style="font-size:12px; color:var(--dim);">กระแสไฟฟ้า</div>
                        <div class="gauge-wrapper"><canvas id="gI"></canvas><div class="gauge-val-text"><span class="val-num" id="iTxt">0</span><br><span class="val-unit">A</span></div></div>
                        <button style="background:#1f2937; border:1px solid #333; color:var(--dim); font-size:10px; padding:3px 8px; border-radius:4px;">กราฟย้อนหลัง</button>
                    </div>
                    <div class="gauge-box">
                        <span class="tor-label" style="position:absolute; top:5px; right:10px;"></span>
                        <div style="font-size:12px; color:var(--dim);">กำลังไฟฟ้า</div>
                        <div class="gauge-wrapper"><canvas id="gP"></canvas><div class="gauge-val-text"><span class="val-num" id="pTxt">0</span><br><span class="val-unit">kW</span></div></div>
                        <button style="background:#1f2937; border:1px solid #333; color:var(--dim); font-size:10px; padding:3px 8px; border-radius:4px;">กราฟย้อนหลัง</button>
                    </div>
                    <div class="gauge-box" style="border-color:var(--yellow)">
                        <span class="tor-label" style="position:absolute; top:5px; right:10px;"></span>
                        <div style="font-size:12px; color:var(--dim);">อุณหภูมิเบรกเกอร์</div>
                        <div class="gauge-wrapper"><canvas id="gT"></canvas><div class="gauge-val-text"><span class="val-num" id="tTxt" style="color:var(--yellow)">0</span><br><span class="val-unit">°C</span></div></div>
                        <button style="background:#1f2937; border:1px solid #333; color:var(--dim); font-size:10px; padding:3px 8px; border-radius:4px;">กราฟย้อนหลัง</button>
                    </div>
                </div>
            </section>

            <section class="card">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span><span class="tor-label"></span> แนวโน้มข้อมูลไฟฟ้า</span>
                    <div style="display:flex; gap:10px; align-items:center;">
                        <span class="tor-label"></span>
                        <button class="btn-capture" onclick="saveImg()">บันทึกภาพกราฟ</button>
                    </div>
                </div>
                <div style="height:250px; margin-top:20px;">
                    <canvas id="lineChart"></canvas>
                </div>
            </section>
        </div>

        <section class="card table-section">
            <div style="display:flex; justify-content:space-between;">
                <span><span class="tor-label"></span> Data Report</span>
                <div><span class="tor-label"></span> <input type="date" style="background:#1f2937; color:#fff; border:1px solid #444; padding:5px; border-radius:4px;"></div>
            </div>
            <table>
                <thead>
                    <tr>
                        <th><span class="tor-label"></span> วันที่/เวลา</th>
                        <th>Site</th>
                        <th>Voltage (V)</th>
                        <th>Current (A)</th>
                        <th>Power (kW)</th>
                        <th>Temp (°C)</th>
                    </tr>
                </thead>
                <tbody id="t-body"></tbody>
            </table>
            <div style="display:flex; justify-content:space-between; margin-top:15px; font-size:12px; color:var(--dim);">
                <span><span class="tor-label"></span> หน้า 1 จาก 45</span>
                <div> < 1 2 3 ... 45 > </div>
            </div>
        </section>
    </main>

    <script>
        // Setup Gauges (Doughnut Chart)
        function createG(id, color, max) {
            return new Chart(document.getElementById(id), {
                type: 'doughnut',
                data: { datasets: [{ data: [0, max], backgroundColor: [color, '#1f2937'], borderWidth: 0, circumference: 270, rotation: 225, cutout: '85%' }] },
                options: { plugins: { legend: { display: false }, tooltip: { enabled: false } }, maintainAspectRatio: false }
            });
        }

        const vG = createG('gV', '#22d3ee', 300);
        const iG = createG('gI', '#22d3ee', 50);
        const pG = createG('gP', '#22d3ee', 10);
        const tG = createG('gT', '#facc15', 100);

        // Main Line Chart
        const lChart = new Chart(document.getElementById('lineChart'), {
            type: 'line',
            data: { labels: [], datasets: [{ label: 'Power', data: [], borderColor: '#22d3ee', backgroundColor: 'rgba(34,211,238,0.05)', fill: true, tension: 0.4 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { grid: { color: '#30363d' } }, x: { grid: { display: false } } } }
        });

        // Real-time Simulation
        function update() {
            const v = (220 + Math.random()*15).toFixed(1);
            const i = (15 + Math.random()*5).toFixed(1);
            const p = (v * i / 1000).toFixed(2);
            const t = (38 + Math.random()*3).toFixed(1);

            document.getElementById('vTxt').innerText = v; vG.data.datasets[0].data = [v, 300-v]; vG.update();
            document.getElementById('iTxt').innerText = i; iG.data.datasets[0].data = [i, 50-i]; iG.update();
            document.getElementById('pTxt').innerText = p; pG.data.datasets[0].data = [p, 10-p]; pG.update();
            document.getElementById('tTxt').innerText = t; tG.data.datasets[0].data = [t, 100-t]; tG.update();

            const now = new Date();
            lChart.data.labels.push(now.toLocaleTimeString());
            lChart.data.datasets[0].data.push(p);
            if(lChart.data.labels.length > 10) { lChart.data.labels.shift(); lChart.data.datasets[0].data.shift(); }
            lChart.update();

            const row = `<tr><td>${now.toLocaleString()}</td><td>SITE-03</td><td>${v}</td><td>${i}</td><td>${p}</td><td>${t}</td></tr>`;
            const tbody = document.getElementById('t-body');
            tbody.insertAdjacentHTML('afterbegin', row);
            if(tbody.children.length > 4) tbody.lastElementChild.remove();

            document.getElementById('clock').innerText = now.toLocaleString('th-TH');
            document.getElementById('sync-time').innerText = `● สถานะ: เชื่อมต่อ (${now.toLocaleTimeString()})`;
        }

        setInterval(update, 5000); // 5 sec for demo, change to 60000 for 1 min (3.6.2)
        update();

        function saveImg() {
            const link = document.createElement('a');
            link.download = 'chart-3.6.3.png';
            link.href = document.getElementById('lineChart').toDataURL();
            link.click();
        }
    </script>
</body>
</html>