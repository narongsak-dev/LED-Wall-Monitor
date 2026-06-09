<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>รายงาน | Electrical Monitoring</title>
    <meta name="description" content="หน้ารายงานข้อมูลไฟฟ้า — สรุปผล กราฟ และตารางข้อมูลย้อนหลัง">
    <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-annotation@3"></script>
    <style>
        :root {
            --bg-body:#0d1117; --bg-card:#161b22; --bg-input:#0d1117;
            --border-color:#30363d; --border-hover:#484f58;
            --cyan:#22d3ee; --cyan-glow:rgba(34,211,238,0.13);
            --yellow:#facc15; --green:#4ade80; --red:#f87171; --purple:#a78bfa;
            --text:#e6edf3; --dim:#8b949e; --dim2:#6e7681;
        }
        *{box-sizing:border-box;font-family:'Sarabun',sans-serif;margin:0;padding:0;}
        body{background:var(--bg-body);color:var(--text);display:flex;height:100vh;overflow:hidden;}

        /* Sidebar */
        .sidebar{width:260px;background:var(--bg-card);border-right:1px solid var(--border-color);display:flex;flex-direction:column;padding:15px;flex-shrink:0;}
        .btn-site{background:none;border:1px solid var(--cyan);color:var(--cyan);width:100%;padding:10px;border-radius:6px;cursor:pointer;font-size:16px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:10px;transition:background .2s;}
        .btn-site:hover{background:var(--cyan-glow);}
        .btn-site-wrapper{margin-bottom:25px;border:1px solid #444;border-radius:8px;padding:10px;}
        .nav-group{border:1px solid var(--border-color);border-radius:8px;padding:8px;}
        .nav-item{display:flex;align-items:center;padding:11px 12px;color:var(--dim);text-decoration:none;border-radius:6px;margin-bottom:3px;font-size:14px;transition:background .2s,color .2s;}
        .nav-item:hover{background:rgba(255,255,255,.05);color:var(--text);}
        .nav-item.active{background:var(--cyan-glow);color:var(--cyan);border-left:3px solid var(--cyan);}
        .nav-item span{margin-right:10px;font-size:16px;}

        /* Main */
        .main-content{flex:1;overflow-y:auto;padding:25px;}
        .page-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:22px;}
        .page-title{color:var(--cyan);font-size:22px;}
        .breadcrumb{font-size:12px;color:var(--dim);margin-top:5px;}
        .breadcrumb span{color:var(--yellow);}
        .header-right{text-align:right;}
        #clock{font-size:15px;font-weight:600;}
        .sync-badge{border:1px solid var(--cyan);color:var(--cyan);padding:4px 12px;border-radius:20px;font-size:12px;margin-top:8px;display:inline-block;}

        /* Filter Bar */
        .filter-bar{background:var(--bg-card);border:1px solid var(--border-color);border-radius:12px;padding:16px 20px;margin-bottom:20px;display:flex;align-items:center;gap:14px;flex-wrap:wrap;}
        .filter-bar label{font-size:12px;color:var(--dim);font-weight:600;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:4px;}
        .filter-bar input, .filter-bar select{
            background:var(--bg-input);border:1px solid var(--border-color);color:var(--text);
            padding:8px 12px;border-radius:8px;font-size:13px;outline:none;transition:border .25s;
            font-family:'Sarabun',sans-serif;
        }
        .filter-bar input:focus,.filter-bar select:focus{border-color:var(--cyan);}
        .filter-group{display:flex;flex-direction:column;}
        .filter-divider{width:1px;height:48px;background:var(--border-color);margin:0 4px;}
        .btn{padding:9px 18px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;border:none;transition:opacity .2s,transform .1s;display:inline-flex;align-items:center;gap:6px;}
        .btn:active{transform:scale(.97);}
        .btn-primary{background:var(--cyan);color:#000;}
        .btn-primary:hover{opacity:.85;}
        .btn-export{background:var(--bg-input);border:1px solid var(--border-color);color:var(--text);}
        .btn-export:hover{border-color:var(--green);color:var(--green);}
        .btn-pdf{background:var(--bg-input);border:1px solid var(--border-color);color:var(--text);}
        .btn-pdf:hover{border-color:var(--red);color:var(--red);}

        /* Stats Row */
        .stats-row{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:20px;}
        .stat-card{background:var(--bg-card);border:1px solid var(--border-color);border-radius:12px;padding:18px;display:flex;flex-direction:column;gap:6px;transition:border-color .2s,transform .2s;}
        .stat-card:hover{border-color:var(--border-hover);transform:translateY(-2px);}
        .stat-top{display:flex;justify-content:space-between;align-items:center;}
        .stat-ico{font-size:22px;}
        .stat-delta{font-size:12px;padding:2px 8px;border-radius:12px;font-weight:600;}
        .delta-up{background:rgba(74,222,128,.15);color:var(--green);}
        .delta-dn{background:rgba(248,113,113,.15);color:var(--red);}
        .delta-eq{background:rgba(250,204,21,.15);color:var(--yellow);}
        .stat-val{font-size:26px;font-weight:700;}
        .stat-label{font-size:12px;color:var(--dim);}
        .stat-sub{font-size:11px;color:var(--dim2);}

        /* Charts */
        .charts-grid{display:grid;grid-template-columns:1.6fr 1fr;gap:16px;margin-bottom:20px;}
        .card{background:var(--bg-card);border:1px solid var(--border-color);border-radius:12px;padding:20px;}
        .card-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;}
        .card-title{font-size:15px;font-weight:700;color:var(--cyan);}
        .chart-tabs{display:flex;gap:6px;}
        .tab-btn{background:var(--bg-input);border:1px solid var(--border-color);color:var(--dim);padding:5px 12px;border-radius:6px;cursor:pointer;font-size:12px;transition:all .2s;}
        .tab-btn.active{background:var(--cyan-glow);border-color:var(--cyan);color:var(--cyan);}
        .chart-wrap{position:relative;}
        .chart-h-300{height:300px;}
        .chart-h-250{height:250px;}

        /* Small charts row */
        .small-charts{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:20px;}
        .small-chart-h{height:160px;}

        /* Table */
        .table-card{background:var(--bg-card);border:1px solid var(--border-color);border-radius:12px;overflow:hidden;}
        .table-toolbar{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid var(--border-color);}
        .table-responsive{overflow-x:auto;}
        table{width:100%;border-collapse:collapse;font-size:13.5px;}
        thead th{background:rgba(34,211,238,.06);color:var(--dim);padding:12px 16px;text-align:left;font-weight:600;border-bottom:1px solid var(--border-color);white-space:nowrap;}
        tbody tr{transition:background .15s;}
        tbody tr:hover{background:rgba(255,255,255,.03);}
        tbody td{padding:11px 16px;border-bottom:1px solid var(--border-color);}
        tbody tr:last-child td{border-bottom:none;}

        .status-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;}
        .dot-ok{background:var(--green);}
        .dot-warn{background:var(--yellow);}
        .dot-err{background:var(--red);}

        .val-warn{color:var(--yellow);font-weight:600;}
        .val-err{color:var(--red);font-weight:600;}
        .val-ok{color:var(--green);}

        /* Pagination */
        .pagination{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;font-size:13px;color:var(--dim);border-top:1px solid var(--border-color);}
        .page-btns{display:flex;gap:5px;}
        .page-btn{background:var(--bg-input);border:1px solid var(--border-color);color:var(--text);width:30px;height:30px;border-radius:6px;cursor:pointer;font-size:13px;display:inline-flex;align-items:center;justify-content:center;transition:all .2s;}
        .page-btn.active{background:var(--cyan);color:#000;border-color:var(--cyan);font-weight:700;}
        .page-btn:hover:not(.active){border-color:var(--cyan);color:var(--cyan);}

        /* Toast */
        #toast-container{position:fixed;bottom:24px;right:24px;z-index:2000;display:flex;flex-direction:column;gap:10px;}
        .toast{background:var(--bg-card);border:1px solid var(--border-color);border-radius:10px;padding:13px 18px;font-size:14px;display:flex;align-items:center;gap:10px;min-width:250px;box-shadow:0 8px 24px rgba(0,0,0,.4);animation:slideInR .3s ease;transition:opacity .4s,transform .4s;}
        .toast.hide{opacity:0;transform:translateX(30px);}
        .toast.success{border-left:3px solid var(--green);}
        .toast.info{border-left:3px solid var(--cyan);}
        @keyframes slideInR{from{opacity:0;transform:translateX(30px);}to{opacity:1;transform:translateX(0);}}
    </style>
</head>
<body>

<!-- Sidebar -->
<aside class="sidebar">
    <div class="btn-site-wrapper">
        <button class="btn-site">🏠 SITE</button>
    </div>
    <div class="nav-group">
        <a href="index.php"   class="nav-item"><span>📊</span> แดชบอร์ดหลัก</a>
        <a href="sites.php"   class="nav-item"><span>🗂️</span> จัดการไซต์</a>
        <a href="reports.php" class="nav-item active"><span>📄</span> รายงาน</a>
        <a href="settings.php"class="nav-item"><span>⚙️</span> ตั้งค่าไซต์</a>
        <a href="sensors.php" class="nav-item"><span>➕</span> เซ็นเซอร์เพิ่มเติม</a>
    </div>
</aside>

<!-- Main -->
<main class="main-content">

    <!-- Header -->
    <div class="page-header">
        <div>
            <h2 class="page-title">รายงาน (Reports)</h2>
            <div class="breadcrumb">หน้าหลัก / <span>รายงาน</span></div>
        </div>
        <div class="header-right">
            <div id="clock">--:--:--</div>
            <div style="font-size:13px;color:var(--dim);margin-top:4px;">Admin User | สิทธิ์: เต็ม</div>
            <div class="sync-badge" id="sync-badge">● เชื่อมต่อแล้ว</div>
        </div>
    </div>

    <!-- Filter Bar -->
    <div class="filter-bar">
        <div class="filter-group">
            <label>ช่วงวันที่เริ่มต้น</label>
            <input type="date" id="f-date-from" value="2026-04-01">
        </div>
        <div class="filter-group">
            <label>ถึงวันที่</label>
            <input type="date" id="f-date-to" value="2026-04-08">
        </div>
        <div class="filter-group">
            <label>ไซต์</label>
            <select id="f-site">
                <option value="">ทุกไซต์</option>
                <option value="SITE-01">SITE-01 ตึกบริหาร A</option>
                <option value="SITE-02">SITE-02 โรงงานผลิต B</option>
                <option value="SITE-03" selected>SITE-03 ตึกปฏิบัติการกลาง</option>
                <option value="SITE-04">SITE-04 คลังสินค้า C</option>
                <option value="SITE-05">SITE-05 อาคารวิจัย D</option>
            </select>
        </div>
        <div class="filter-group">
            <label>ความละเอียด</label>
            <select id="f-interval">
                <option value="5min">ทุก 5 นาที</option>
                <option value="15min">ทุก 15 นาที</option>
                <option value="1h" selected>ทุก 1 ชั่วโมง</option>
                <option value="1d">รายวัน</option>
            </select>
        </div>
        <div class="filter-group">
            <label>ประเภทรายงาน</label>
            <select id="f-type">
                <option value="all">ทั้งหมด</option>
                <option value="alarm">เฉพาะค่าผิดปกติ</option>
                <option value="peak">Peak Demand</option>
            </select>
        </div>
        <div class="filter-divider"></div>
        <div style="display:flex;flex-direction:column;gap:6px;margin-top:auto;">
            <button class="btn btn-primary" onclick="applyFilter()">🔍 แสดงรายงาน</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;margin-top:auto;margin-left:auto;">
            <button class="btn btn-export" onclick="exportCSV()">⬇️ Export CSV</button>
            <button class="btn btn-pdf"    onclick="exportPDF()">🖨️ พิมพ์ PDF</button>
        </div>
    </div>

    <!-- Stats -->
    <div class="stats-row" id="stats-row">
        <div class="stat-card">
            <div class="stat-top"><span class="stat-ico">⚡</span><span class="stat-delta delta-up">↑ 3.2%</span></div>
            <div class="stat-val" style="color:var(--cyan);" id="s-energy">1,248.4</div>
            <div class="stat-label">พลังงานรวม (kWh)</div>
            <div class="stat-sub">เทียบเดือนก่อน: 1,208.9 kWh</div>
        </div>
        <div class="stat-card">
            <div class="stat-top"><span class="stat-ico">📈</span><span class="stat-delta delta-dn">↓ 1.5%</span></div>
            <div class="stat-val" style="color:var(--yellow);" id="s-peak">7.84</div>
            <div class="stat-label">Peak Demand (kW)</div>
            <div class="stat-sub">เวลา: 14:05 น. วันที่ 4 เม.ย.</div>
        </div>
        <div class="stat-card">
            <div class="stat-top"><span class="stat-ico">🌡️</span><span class="stat-delta delta-eq">= 0.0%</span></div>
            <div class="stat-val" style="color:var(--red);" id="s-temp">43.6</div>
            <div class="stat-label">อุณหภูมิสูงสุด (°C)</div>
            <div class="stat-sub">เกินขีด 50°C: 0 ครั้ง</div>
        </div>
        <div class="stat-card">
            <div class="stat-top"><span class="stat-ico">🚨</span><span class="stat-delta delta-dn">↓ 2 ครั้ง</span></div>
            <div class="stat-val" style="color:var(--purple);" id="s-alarm">5</div>
            <div class="stat-label">การแจ้งเตือนทั้งหมด</div>
            <div class="stat-sub">แก้ไขแล้ว 4 / รอดำเนินการ 1</div>
        </div>
    </div>

    <!-- Charts Row -->
    <div class="charts-grid">
        <!-- Line Chart -->
        <div class="card">
            <div class="card-header">
                <div class="card-title">📉 แนวโน้มค่าพลังงาน (Power Trend)</div>
                <div class="chart-tabs">
                    <button class="tab-btn active" onclick="switchLine('power',this)">กำลัง</button>
                    <button class="tab-btn" onclick="switchLine('voltage',this)">แรงดัน</button>
                    <button class="tab-btn" onclick="switchLine('current',this)">กระแส</button>
                    <button class="tab-btn" onclick="switchLine('temp',this)">อุณหภูมิ</button>
                </div>
            </div>
            <div class="chart-wrap chart-h-300">
                <canvas id="lineChart"></canvas>
            </div>
        </div>
        <!-- Donut -->
        <div class="card">
            <div class="card-header">
                <div class="card-title">🔋 สัดส่วนการใช้พลังงาน</div>
            </div>
            <div class="chart-wrap chart-h-300" style="position:relative;">
                <canvas id="donutChart"></canvas>
                <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;pointer-events:none;">
                    <div style="font-size:22px;font-weight:700;color:var(--cyan);" id="donut-total">1,248</div>
                    <div style="font-size:11px;color:var(--dim);">kWh รวม</div>
                </div>
            </div>
        </div>
    </div>

    <!-- Small Charts -->
    <div class="small-charts">
        <div class="card">
            <div class="card-header">
                <div class="card-title">📊 กำลังรายวัน (kW)</div>
            </div>
            <div class="chart-wrap small-chart-h"><canvas id="barDay"></canvas></div>
        </div>
        <div class="card">
            <div class="card-header">
                <div class="card-title">🌡️ อุณหภูมิสูงสุดรายวัน</div>
            </div>
            <div class="chart-wrap small-chart-h"><canvas id="barTemp"></canvas></div>
        </div>
        <div class="card">
            <div class="card-header">
                <div class="card-title">🚨 การแจ้งเตือนสะสม</div>
            </div>
            <div class="chart-wrap small-chart-h"><canvas id="barAlarm"></canvas></div>
        </div>
    </div>

    <!-- Data Table -->
    <div class="table-card">
        <div class="table-toolbar">
            <div style="font-size:15px;font-weight:700;color:var(--cyan);">📋 ตารางข้อมูลดิบ</div>
            <div style="display:flex;align-items:center;gap:12px;">
                <input type="text" id="tbl-search" placeholder="🔍 กรองตาราง..." style="background:var(--bg-input);border:1px solid var(--border-color);color:var(--text);padding:7px 12px;border-radius:8px;font-size:13px;outline:none;width:200px;" oninput="filterTable()">
                <select id="tbl-alarm-only" style="background:var(--bg-input);border:1px solid var(--border-color);color:var(--text);padding:7px 12px;border-radius:8px;font-size:13px;outline:none;" onchange="filterTable()">
                    <option value="">ทุกค่า</option>
                    <option value="warn">เฉพาะค่าเตือน</option>
                </select>
                <span style="font-size:12px;color:var(--dim);" id="row-count"></span>
            </div>
        </div>
        <div class="table-responsive">
            <table>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>วันที่ / เวลา</th>
                        <th>ไซต์</th>
                        <th>แรงดัน (V)</th>
                        <th>กระแส (A)</th>
                        <th>กำลัง (kW)</th>
                        <th>พลังงาน (kWh)</th>
                        <th>อุณหภูมิ (°C)</th>
                        <th>สถานะ</th>
                    </tr>
                </thead>
                <tbody id="table-body"></tbody>
            </table>
        </div>
        <div class="pagination">
            <div id="paging-info" style="color:var(--dim);font-size:13px;"></div>
            <div class="page-btns" id="page-btns"></div>
        </div>
    </div>

</main>

<div id="toast-container"></div>

<script>
// ─── Mock Data ────────────────────────────────────────────────────────────────
const HOURS = ['00:00','01:00','02:00','03:00','04:00','05:00','06:00','07:00',
               '08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00',
               '16:00','17:00','18:00','19:00','20:00','21:00','22:00','23:00'];
const DAYS   = ['1 เม.ย.','2 เม.ย.','3 เม.ย.','4 เม.ย.','5 เม.ย.','6 เม.ย.','7 เม.ย.','8 เม.ย.'];

function rnd(min,max,dec=2){ return parseFloat((Math.random()*(max-min)+min).toFixed(dec)); }

// Generate raw rows
const rawRows = [];
const sites = ['SITE-03'];
for(let d=0;d<8;d++){
    for(let h=0;h<24;h++){
        const v = rnd(218,234,1);
        const i = rnd(13,22,1);
        const p = parseFloat((v*i/1000).toFixed(2));
        const e = parseFloat((p*1).toFixed(2));
        const t = rnd(34,48,1);
        const isWarn = (v < 210 || v > 230 || t > 42);
        rawRows.push({
            dt: `${d+1} เม.ย. ${String(h).padStart(2,'0')}:00`,
            site:'SITE-03', v, i, p, e, t, warn: isWarn
        });
    }
}

// ─── Chart instances ──────────────────────────────────────────────────────────
let lineChart, donutChart, barDay, barTemp, barAlarm;
let currentLineMode = 'power';

const GRID_COLOR = '#30363d';
const CHART_DEFAULTS = {
    color: '#8b949e',
    borderColor: '#30363d',
};

function makeAxis(color){ return { grid:{color:GRID_COLOR}, ticks:{color:GRID_COLOR} }; }

// Line Chart
function lineDatasets(mode){
    const palette = { power:'#22d3ee', voltage:'#facc15', current:'#4ade80', temp:'#f87171' };
    const valueMap = {
        power:   rawRows.slice(0,24).map(r=>r.p),
        voltage: rawRows.slice(0,24).map(r=>r.v),
        current: rawRows.slice(0,24).map(r=>r.i),
        temp:    rawRows.slice(0,24).map(r=>r.t),
    };
    const labels = { power:'กำลัง (kW)', voltage:'แรงดัน (V)', current:'กระแส (A)', temp:'อุณหภูมิ (°C)' };
    return [{
        label: labels[mode],
        data: valueMap[mode],
        borderColor: palette[mode],
        backgroundColor: palette[mode].replace(')',',0.07)').replace('rgb','rgba'),
        fill: true, tension: 0.4, pointRadius: 3,
        pointBackgroundColor: palette[mode],
        borderWidth: 2,
    }];
}

function initCharts(){
    // Line
    lineChart = new Chart(document.getElementById('lineChart'),{
        type:'line',
        data:{ labels:HOURS, datasets: lineDatasets('power') },
        options:{ responsive:true, maintainAspectRatio:false,
            plugins:{ legend:{ display:false } },
            scales:{ y:{ grid:{color:GRID_COLOR}, ticks:{color:GRID_COLOR} }, x:{ grid:{display:false}, ticks:{color:GRID_COLOR} } }
        }
    });

    // Donut
    donutChart = new Chart(document.getElementById('donutChart'),{
        type:'doughnut',
        data:{
            labels:['แสงสว่าง','เครื่องจักร','ระบบปรับอากาศ','อื่นๆ'],
            datasets:[{
                data:[320,540,280,108],
                backgroundColor:['#22d3ee','#facc15','#4ade80','#a78bfa'],
                borderWidth:0, cutout:'72%',
            }]
        },
        options:{ responsive:true, maintainAspectRatio:false,
            plugins:{
                legend:{ position:'bottom', labels:{ color:'#8b949e', padding:14, font:{size:12} } }
            }
        }
    });

    // Bar Day
    barDay = new Chart(document.getElementById('barDay'),{
        type:'bar',
        data:{ labels:DAYS, datasets:[{
            label:'kW เฉลี่ย',
            data:DAYS.map(()=>rnd(3.5,7.5,2)),
            backgroundColor:'rgba(34,211,238,0.5)', borderColor:'#22d3ee', borderWidth:1, borderRadius:4,
        }]},
        options:{ responsive:true, maintainAspectRatio:false,
            plugins:{legend:{display:false}},
            scales:{ y:{grid:{color:GRID_COLOR},ticks:{color:GRID_COLOR}}, x:{grid:{display:false},ticks:{color:GRID_COLOR}} }
        }
    });

    // Bar Temp
    const tempData = DAYS.map(()=>rnd(36,47,1));
    barTemp = new Chart(document.getElementById('barTemp'),{
        type:'bar',
        data:{ labels:DAYS, datasets:[{
            label:'°C สูงสุด',
            data: tempData,
            backgroundColor: tempData.map(v => v>43 ? 'rgba(248,113,113,0.6)' : 'rgba(250,204,21,0.4)'),
            borderColor:     tempData.map(v => v>43 ? '#f87171' : '#facc15'),
            borderWidth:1, borderRadius:4,
        }]},
        options:{ responsive:true, maintainAspectRatio:false,
            plugins:{legend:{display:false}},
            scales:{ y:{grid:{color:GRID_COLOR},ticks:{color:GRID_COLOR},min:30},
                     x:{grid:{display:false},ticks:{color:GRID_COLOR}} }
        }
    });

    // Bar Alarm
    barAlarm = new Chart(document.getElementById('barAlarm'),{
        type:'bar',
        data:{ labels:DAYS, datasets:[
            { label:'กระแสเกิน', data:DAYS.map(()=>Math.floor(Math.random()*3)), backgroundColor:'rgba(167,139,250,0.6)', borderColor:'#a78bfa', borderWidth:1, borderRadius:4 },
            { label:'แรงดันผิดปกติ', data:DAYS.map(()=>Math.floor(Math.random()*2)), backgroundColor:'rgba(34,211,238,0.4)', borderColor:'#22d3ee', borderWidth:1, borderRadius:4 },
        ]},
        options:{ responsive:true, maintainAspectRatio:false,
            plugins:{ legend:{ labels:{color:'#8b949e',font:{size:11}}, position:'bottom' } },
            scales:{ y:{grid:{color:GRID_COLOR},ticks:{color:GRID_COLOR},stacked:true},
                     x:{grid:{display:false},ticks:{color:GRID_COLOR},stacked:true} }
        }
    });
}

function switchLine(mode, btn){
    currentLineMode = mode;
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    lineChart.data.datasets = lineDatasets(mode);
    lineChart.update('active');
}

// ─── Table ────────────────────────────────────────────────────────────────────
let currentPage = 1;
const perPage   = 10;
let filteredRows = [...rawRows];

function filterTable(){
    const q    = document.getElementById('tbl-search').value.toLowerCase();
    const warn = document.getElementById('tbl-alarm-only').value;
    filteredRows = rawRows.filter(r => {
        const matchQ    = !q || r.dt.toLowerCase().includes(q) || r.site.toLowerCase().includes(q);
        const matchWarn = warn !== 'warn' || r.warn;
        return matchQ && matchWarn;
    });
    currentPage = 1;
    renderTable();
}

function renderTable(){
    const total = filteredRows.length;
    const pages = Math.max(1, Math.ceil(total / perPage));
    if(currentPage > pages) currentPage = pages;
    const start = (currentPage-1)*perPage;
    const page  = filteredRows.slice(start, start+perPage);

    document.getElementById('row-count').textContent = `${total} รายการ`;

    const statusCell = (r) =>{
        if(r.t > 45) return `<span class="status-dot dot-err"></span>อุณหภูมิสูง`;
        if(r.warn)   return `<span class="status-dot dot-warn"></span>ผิดปกติ`;
        return `<span class="status-dot dot-ok"></span>ปกติ`;
    };

    document.getElementById('table-body').innerHTML = page.map((r,i)=>`
        <tr>
            <td style="color:var(--dim2);">${start+i+1}</td>
            <td style="font-size:12px;color:var(--dim);">${r.dt}</td>
            <td style="color:var(--cyan);font-weight:600;">${r.site}</td>
            <td class="${r.v<210||r.v>230 ? 'val-warn':''}">${r.v}</td>
            <td class="${r.i>20 ? 'val-warn':''}">${r.i}</td>
            <td class="${r.p>7 ? 'val-warn' : 'val-ok'}">${r.p}</td>
            <td>${r.e}</td>
            <td class="${r.t>45 ? 'val-err' : r.t>42 ? 'val-warn':''}">${r.t}</td>
            <td style="font-size:12px;">${statusCell(r)}</td>
        </tr>
    `).join('');

    const from = total===0?0:start+1, to = Math.min(start+perPage,total);
    document.getElementById('paging-info').textContent = `แสดง ${from} – ${to} จาก ${total} รายการ`;

    const pb = document.getElementById('page-btns');
    pb.innerHTML = '';
    const maxBtn = 7;
    let startPage = Math.max(1, currentPage-3), endPage = Math.min(pages, startPage+maxBtn-1);
    if(endPage-startPage < maxBtn-1) startPage = Math.max(1, endPage-maxBtn+1);
    for(let p=startPage;p<=endPage;p++){
        const b = document.createElement('button');
        b.className = 'page-btn'+(p===currentPage?' active':'');
        b.textContent = p;
        b.onclick = ()=>{ currentPage=p; renderTable(); };
        pb.appendChild(b);
    }
}

// ─── Filter Apply (re-generate mock) ─────────────────────────────────────────
function applyFilter(){
    toast('โหลดข้อมูลเรียบร้อย (Mockup)', 'success');
    filterTable();
}

// ─── Export ───────────────────────────────────────────────────────────────────
function exportCSV(){
    const headers = ['ลำดับ','วันที่/เวลา','ไซต์','แรงดัน (V)','กระแส (A)','กำลัง (kW)','พลังงาน (kWh)','อุณหภูมิ (°C)','สถานะ'];
    const rows = filteredRows.map((r,i)=>[
        i+1, r.dt, r.site, r.v, r.i, r.p, r.e, r.t, r.warn ? 'ผิดปกติ' : 'ปกติ'
    ]);
    const csv = [headers, ...rows].map(r=>r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF'+csv], { type:'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `report_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    toast('ดาวน์โหลด CSV แล้ว', 'success');
}

function exportPDF(){
    toast('กำลังเตรียม PDF... (Mockup)', 'info');
    setTimeout(()=>window.print(), 400);
}

// ─── Clock ────────────────────────────────────────────────────────────────────
function updateClock(){
    const now = new Date();
    document.getElementById('clock').textContent = now.toLocaleString('th-TH',{hour12:false});
    document.getElementById('sync-badge').textContent = `● เชื่อมต่อแล้ว (${now.toLocaleTimeString('th-TH')})`;
}
setInterval(updateClock,1000); updateClock();

// ─── Toast ────────────────────────────────────────────────────────────────────
function toast(msg, type='success'){
    const icons = { success:'✅', info:'ℹ️', error:'❌' };
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
    document.getElementById('toast-container').appendChild(t);
    setTimeout(()=>{ t.classList.add('hide'); setTimeout(()=>t.remove(),400); }, 2800);
}

// ─── Init ─────────────────────────────────────────────────────────────────────
initCharts();
filterTable();
</script>
</body>
</html>
