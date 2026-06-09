<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>จัดการไซต์ | Electrical Monitoring</title>
    <meta name="description" content="หน้าจัดการไซต์ระบบติดตามไฟฟ้า — เพิ่ม แก้ไข ลบ ไซต์ (CRUD Mockup)">
    <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-body: #0d1117; --bg-card: #161b22; --bg-input: #0d1117;
            --border-color: #30363d; --border-hover: #484f58;
            --cyan: #22d3ee; --cyan-dark: #0ea5e9; --cyan-glow: rgba(34,211,238,0.15);
            --yellow: #facc15; --green: #4ade80; --red: #f87171;
            --text: #e6edf3; --dim: #8b949e; --dim2: #6e7681;
        }
        * { box-sizing: border-box; font-family: 'Sarabun', sans-serif; margin: 0; padding: 0; }
        body { background-color: var(--bg-body); color: var(--text); display: flex; height: 100vh; overflow: hidden; }

        /* ─── Sidebar ─────────────────────────────────────── */
        .sidebar { width: 260px; background: var(--bg-card); border-right: 1px solid var(--border-color); display: flex; flex-direction: column; padding: 15px; flex-shrink: 0; }
        .tor-label { color: var(--yellow); font-size: 11px; margin-bottom: 4px; display: block; font-weight: bold; }
        .btn-site-wrapper { margin-bottom: 25px; border: 1px solid #444; border-radius: 8px; padding: 10px; }
        .btn-site { background: none; border: 1px solid var(--cyan); color: var(--cyan); width: 100%; padding: 10px; border-radius: 6px; cursor: pointer; font-size: 16px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 10px; transition: background 0.2s; }
        .btn-site:hover { background: var(--cyan-glow); }
        .nav-group { border: 1px solid var(--border-color); border-radius: 8px; padding: 8px; }
        .nav-item { display: flex; align-items: center; padding: 11px 12px; color: var(--dim); text-decoration: none; border-radius: 6px; margin-bottom: 3px; font-size: 14px; transition: background 0.2s, color 0.2s; }
        .nav-item:hover { background: rgba(255,255,255,0.05); color: var(--text); }
        .nav-item.active { background: var(--cyan-glow); color: var(--cyan); border-left: 3px solid var(--cyan); }
        .nav-item span { margin-right: 10px; font-size: 16px; }

        /* ─── Main ────────────────────────────────────────── */
        .main-content { flex-grow: 1; overflow-y: auto; padding: 25px; }

        .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; }
        .page-title { color: var(--cyan); font-size: 22px; }
        .breadcrumb { font-size: 12px; color: var(--dim); margin-top: 5px; }
        .breadcrumb span { color: var(--yellow); }

        .header-right { text-align: right; }
        #clock { font-size: 15px; font-weight: 600; }
        .sync-badge { border: 1px solid var(--cyan); color: var(--cyan); padding: 4px 12px; border-radius: 20px; font-size: 12px; margin-top: 8px; display: inline-block; }

        /* ─── Toolbar ─────────────────────────────────────── */
        .toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; gap: 12px; flex-wrap: wrap; }
        .search-box { position: relative; flex: 1; max-width: 340px; }
        .search-box input { width: 100%; background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text); padding: 9px 12px 9px 36px; border-radius: 8px; font-size: 14px; outline: none; transition: border 0.25s; }
        .search-box input:focus { border-color: var(--cyan); }
        .search-box .ico { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--dim); font-size: 15px; }
        .btn { padding: 9px 18px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600; border: none; transition: opacity 0.2s, transform 0.1s; display: inline-flex; align-items: center; gap: 6px; }
        .btn:active { transform: scale(0.97); }
        .btn-primary { background: var(--cyan); color: #000; }
        .btn-primary:hover { opacity: 0.85; }
        .btn-danger { background: var(--red); color: #000; }
        .btn-secondary { background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text); }
        .btn-secondary:hover { border-color: var(--cyan); }

        /* ─── Table ───────────────────────────────────────── */
        .card { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 12px; overflow: hidden; }
        .table-responsive { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
        thead th { background: rgba(34,211,238,0.06); color: var(--dim); padding: 13px 16px; text-align: left; font-weight: 600; border-bottom: 1px solid var(--border-color); white-space: nowrap; }
        thead th.sortable { cursor: pointer; user-select: none; }
        thead th.sortable:hover { color: var(--cyan); }
        tbody tr { transition: background 0.15s; }
        tbody tr:hover { background: rgba(255,255,255,0.03); }
        tbody td { padding: 13px 16px; border-bottom: 1px solid var(--border-color); vertical-align: middle; }
        tbody tr:last-child td { border-bottom: none; }

        .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
        .badge-online  { background: rgba(74,222,128,0.15); color: var(--green); border: 1px solid rgba(74,222,128,0.3); }
        .badge-offline { background: rgba(248,113,113,0.15); color: var(--red); border: 1px solid rgba(248,113,113,0.3); }
        .badge-warning { background: rgba(250,204,21,0.15); color: var(--yellow); border: 1px solid rgba(250,204,21,0.3); }

        .action-btns { display: flex; gap: 8px; }
        .icon-btn { background: none; border: 1px solid var(--border-color); color: var(--dim); width: 32px; height: 32px; border-radius: 6px; cursor: pointer; font-size: 14px; display: inline-flex; align-items: center; justify-content: center; transition: all 0.2s; }
        .icon-btn:hover.edit-btn  { border-color: var(--cyan); color: var(--cyan); background: var(--cyan-glow); }
        .icon-btn:hover.del-btn   { border-color: var(--red);  color: var(--red);  background: rgba(248,113,113,0.1); }
        .icon-btn:hover.view-btn  { border-color: var(--green); color: var(--green); background: rgba(74,222,128,0.1); }

        .pagination { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; font-size: 13px; color: var(--dim); border-top: 1px solid var(--border-color); }
        .page-btns { display: flex; gap: 5px; }
        .page-btn { background: var(--bg-input); border: 1px solid var(--border-color); color: var(--text); width: 32px; height: 32px; border-radius: 6px; cursor: pointer; font-size: 13px; display: inline-flex; align-items: center; justify-content: center; transition: all 0.2s; }
        .page-btn.active { background: var(--cyan); color: #000; border-color: var(--cyan); font-weight: 700; }
        .page-btn:hover:not(.active) { border-color: var(--cyan); color: var(--cyan); }

        /* ─── Modal ───────────────────────────────────────── */
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); z-index: 1000; display: none; align-items: center; justify-content: center; }
        .modal-overlay.show { display: flex; animation: fadeIn 0.2s ease; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .modal { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 14px; padding: 28px; width: 100%; max-width: 580px; max-height: 90vh; overflow-y: auto; box-shadow: 0 25px 60px rgba(0,0,0,0.5); animation: slideUp 0.25s ease; }
        @keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 22px; }
        .modal-title { font-size: 18px; font-weight: 700; color: var(--cyan); }
        .modal-close { background: none; border: none; color: var(--dim); font-size: 22px; cursor: pointer; line-height: 1; transition: color 0.2s; }
        .modal-close:hover { color: var(--text); }
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .form-group { margin-bottom: 4px; }
        .form-group.full { grid-column: span 2; }
        .form-group label { display: block; font-size: 12px; color: var(--dim); margin-bottom: 6px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
        .form-group input, .form-group select, .form-group textarea {
            width: 100%; padding: 10px 12px; background: var(--bg-input);
            border: 1px solid var(--border-color); color: var(--text);
            border-radius: 8px; font-size: 14px; outline: none; transition: border 0.25s;
            font-family: 'Sarabun', sans-serif;
        }
        .form-group input:focus, .form-group select:focus, .form-group textarea:focus { border-color: var(--cyan); }
        .form-group textarea { resize: vertical; min-height: 70px; }
        .modal-footer { display: flex; justify-content: flex-end; gap: 10px; margin-top: 22px; }

        /* ─── Confirm Dialog ──────────────────────────────── */
        .confirm-modal { max-width: 400px; text-align: center; }
        .confirm-icon { font-size: 48px; margin-bottom: 12px; }
        .confirm-text { color: var(--dim); font-size: 14px; margin-top: 8px; }

        /* ─── Toast ───────────────────────────────────────── */
        #toast-container { position: fixed; bottom: 24px; right: 24px; z-index: 2000; display: flex; flex-direction: column; gap: 10px; }
        .toast { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 10px; padding: 14px 18px; font-size: 14px; display: flex; align-items: center; gap: 10px; min-width: 260px; box-shadow: 0 8px 24px rgba(0,0,0,0.4); animation: slideInRight 0.3s ease; transition: opacity 0.4s, transform 0.4s; }
        .toast.hide { opacity: 0; transform: translateX(30px); }
        @keyframes slideInRight { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); } }
        .toast.success { border-left: 3px solid var(--green); }
        .toast.error   { border-left: 3px solid var(--red); }
        .toast.info    { border-left: 3px solid var(--cyan); }

        /* ─── Empty State ─────────────────────────────────── */
        .empty-state { text-align: center; padding: 60px 20px; color: var(--dim); }
        .empty-state .ico { font-size: 48px; margin-bottom: 12px; }

        /* ─── Stats Row ───────────────────────────────────── */
        .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 22px; }
        .stat-card { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 10px; padding: 16px 18px; display: flex; align-items: center; gap: 14px; transition: border-color 0.2s; }
        .stat-card:hover { border-color: var(--border-hover); }
        .stat-ico { font-size: 26px; }
        .stat-label { font-size: 12px; color: var(--dim); }
        .stat-val { font-size: 22px; font-weight: 700; }
        .stat-val.cyan { color: var(--cyan); }
        .stat-val.green { color: var(--green); }
        .stat-val.red { color: var(--red); }
        .stat-val.yellow { color: var(--yellow); }
    </style>
</head>
<body>

    <!-- Sidebar -->
    <aside class="sidebar">
        <div class="btn-site-wrapper">
            <button class="btn-site">🏠 SITE</button>
        </div>
        <div class="nav-group">
            <a href="index.php"    class="nav-item"><span>📊</span> แดชบอร์ดหลัก</a>
            <a href="sites.php"    class="nav-item active"><span>🗂️</span> จัดการไซต์</a>
            <a href="reports.php"  class="nav-item"><span>📄</span> รายงาน</a>
            <a href="settings.php" class="nav-item"><span>⚙️</span> ตั้งค่าไซต์</a>
            <a href="sensors.php"  class="nav-item"><span>➕</span> เซ็นเซอร์เพิ่มเติม</a>
        </div>
    </aside>

    <!-- Main -->
    <main class="main-content">
        <!-- Header -->
        <div class="page-header">
            <div>
                <h2 class="page-title">จัดการไซต์ (Site Management)</h2>
                <div class="breadcrumb">หน้าหลัก / <span>จัดการไซต์</span></div>
            </div>
            <div class="header-right">
                <div id="clock">--:--:--</div>
                <div style="font-size:13px; color:var(--dim); margin-top:4px;">Admin User | สิทธิ์: เต็ม</div>
                <div class="sync-badge" id="sync-badge">● เชื่อมต่อแล้ว</div>
            </div>
        </div>

        <!-- Stats -->
        <div class="stats-row" id="stats-row"></div>

        <!-- Toolbar -->
        <div class="toolbar">
            <div class="search-box">
                <span class="ico">🔍</span>
                <input type="text" id="search-input" placeholder="ค้นหาไซต์ (ชื่อ, รหัส, สถานที่...)">
            </div>
            <div style="display:flex; gap:10px;">
                <select id="filter-status" style="background:var(--bg-card); border:1px solid var(--border-color); color:var(--text); padding:9px 12px; border-radius:8px; font-size:14px; cursor:pointer; outline:none;">
                    <option value="">ทุกสถานะ</option>
                    <option value="online">🟢 Online</option>
                    <option value="offline">🔴 Offline</option>
                    <option value="warning">🟡 Warning</option>
                </select>
                <button class="btn btn-primary" id="btn-add" onclick="openAddModal()">➕ เพิ่มไซต์ใหม่</button>
            </div>
        </div>

        <!-- Table Card -->
        <div class="card">
            <div class="table-responsive">
                <table id="site-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th class="sortable" onclick="sortTable('site_id')">รหัสไซต์ ↕</th>
                            <th class="sortable" onclick="sortTable('site_name')">ชื่อไซต์ ↕</th>
                            <th>สถานที่</th>
                            <th>ประเภท</th>
                            <th>สถานะ</th>
                            <th>IP Address</th>
                            <th>อัปเดตล่าสุด</th>
                            <th style="text-align:center;">จัดการ</th>
                        </tr>
                    </thead>
                    <tbody id="table-body"></tbody>
                </table>
            </div>
            <div id="empty-state" class="empty-state" style="display:none;">
                <div class="ico">🔌</div>
                <div>ไม่พบข้อมูลไซต์</div>
            </div>
            <div class="pagination" id="pagination">
                <div id="paging-info">แสดง 0 – 0 จาก 0 รายการ</div>
                <div class="page-btns" id="page-btns"></div>
            </div>
        </div>
    </main>

    <!-- ─── Add / Edit Modal ──────────────────────────────────────── -->
    <div class="modal-overlay" id="modal-form">
        <div class="modal">
            <div class="modal-header">
                <div class="modal-title" id="modal-title">➕ เพิ่มไซต์ใหม่</div>
                <button class="modal-close" onclick="closeFormModal()">✕</button>
            </div>
            <div class="form-grid">
                <div class="form-group">
                    <label>รหัสไซต์ *</label>
                    <input type="text" id="f-site_id" placeholder="เช่น SITE-04" maxlength="20">
                </div>
                <div class="form-group">
                    <label>ชื่อไซต์ *</label>
                    <input type="text" id="f-site_name" placeholder="เช่น ตึก A">
                </div>
                <div class="form-group">
                    <label>สถานที่</label>
                    <input type="text" id="f-location" placeholder="เช่น กรุงเทพมหานคร">
                </div>
                <div class="form-group">
                    <label>ประเภทไซต์</label>
                    <select id="f-type">
                        <option>อาคารสำนักงาน</option>
                        <option>โรงงาน</option>
                        <option>ตึกเรียน</option>
                        <option>คลังสินค้า</option>
                        <option>อื่นๆ</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>IP Address</label>
                    <input type="text" id="f-ip" placeholder="เช่น 192.168.1.10">
                </div>
                <div class="form-group">
                    <label>สถานะ</label>
                    <select id="f-status">
                        <option value="online">🟢 Online</option>
                        <option value="warning">🟡 Warning</option>
                        <option value="offline">🔴 Offline</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>เบอร์ติดต่อฉุกเฉิน</label>
                    <input type="text" id="f-contact" placeholder="เช่น 081-234-5678">
                </div>
                <div class="form-group">
                    <label>แรงดันไฟฟ้าปกติ (V)</label>
                    <input type="number" id="f-voltage" placeholder="220" step="0.1">
                </div>
                <div class="form-group full">
                    <label>หมายเหตุ</label>
                    <textarea id="f-note" placeholder="รายละเอียดเพิ่มเติม..."></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeFormModal()">ยกเลิก</button>
                <button class="btn btn-primary" onclick="saveRecord()">💾 บันทึก</button>
            </div>
        </div>
    </div>

    <!-- ─── Delete Confirm Modal ──────────────────────────────────── -->
    <div class="modal-overlay" id="modal-confirm">
        <div class="modal confirm-modal">
            <div class="confirm-icon">🗑️</div>
            <h3 style="color:var(--text);">ยืนยันการลบ</h3>
            <p class="confirm-text">คุณแน่ใจหรือไม่ที่จะลบไซต์ <strong id="confirm-name" style="color:var(--red);"></strong>?<br>ข้อมูลจะถูกลบออกและไม่สามารถกู้คืนได้</p>
            <div class="modal-footer" style="justify-content:center; margin-top:18px;">
                <button class="btn btn-secondary" onclick="closeConfirm()">ยกเลิก</button>
                <button class="btn btn-danger" onclick="confirmDelete()">ลบเลย</button>
            </div>
        </div>
    </div>

    <!-- ─── View Modal ────────────────────────────────────────────── -->
    <div class="modal-overlay" id="modal-view">
        <div class="modal">
            <div class="modal-header">
                <div class="modal-title">📋 รายละเอียดไซต์</div>
                <button class="modal-close" onclick="closeViewModal()">✕</button>
            </div>
            <div id="view-content"></div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeViewModal()">ปิด</button>
                <button class="btn btn-primary" onclick="editFromView()">✏️ แก้ไข</button>
            </div>
        </div>
    </div>

    <!-- Toast -->
    <div id="toast-container"></div>

<script>
// ─── Mock Data ────────────────────────────────────────────────────────────────
let sites = [
    { id:1, site_id:'SITE-01', site_name:'ตึกบริหาร A',        location:'กรุงเทพมหานคร', type:'อาคารสำนักงาน', status:'online',  ip:'192.168.1.10', contact:'081-100-0001', voltage:220, note:'อาคารหลัก ชั้น 1-10',         updated:'2026-04-08 09:00' },
    { id:2, site_id:'SITE-02', site_name:'โรงงานผลิต B',       location:'สมุทรปราการ',   type:'โรงงาน',        status:'online',  ip:'192.168.1.11', contact:'081-100-0002', voltage:380, note:'ระบบ 3 เฟส',                 updated:'2026-04-08 09:05' },
    { id:3, site_id:'SITE-03', site_name:'ตึกปฏิบัติการกลาง', location:'กรุงเทพมหานคร', type:'ตึกเรียน',      status:'warning', ip:'192.168.1.12', contact:'081-100-0003', voltage:220, note:'อุณหภูมิเบรกเกอร์สูงกว่ากำหนด', updated:'2026-04-08 10:30' },
    { id:4, site_id:'SITE-04', site_name:'คลังสินค้า C',       location:'ปทุมธานี',      type:'คลังสินค้า',    status:'offline', ip:'192.168.1.13', contact:'081-100-0004', voltage:220, note:'ปิดปรับปรุงชั่วคราว',         updated:'2026-04-07 18:00' },
    { id:5, site_id:'SITE-05', site_name:'อาคารวิจัย D',       location:'เชียงใหม่',     type:'อาคารสำนักงาน', status:'online',  ip:'192.168.1.14', contact:'081-100-0005', voltage:220, note:'',                            updated:'2026-04-08 08:45' },
    { id:6, site_id:'SITE-06', site_name:'โรงงานบรรจุ E',      location:'ชลบุรี',        type:'โรงงาน',        status:'online',  ip:'192.168.1.15', contact:'081-100-0006', voltage:380, note:'',                            updated:'2026-04-08 09:20' },
    { id:7, site_id:'SITE-07', site_name:'ศูนย์ข้อมูล F',      location:'กรุงเทพมหานคร', type:'อาคารสำนักงาน', status:'online',  ip:'192.168.10.1', contact:'081-100-0007', voltage:220, note:'Data Center 24/7',            updated:'2026-04-08 09:55' },
];
let nextId = 8;

// ─── State ────────────────────────────────────────────────────────────────────
let editingId   = null;
let deletingId  = null;
let viewingId   = null;
let searchQuery = '';
let filterStatus= '';
let sortKey     = 'site_id';
let sortAsc     = true;
let currentPage = 1;
const perPage   = 5;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function statusBadge(s) {
    if (s === 'online')  return '<span class="badge badge-online">🟢 Online</span>';
    if (s === 'offline') return '<span class="badge badge-offline">🔴 Offline</span>';
    return '<span class="badge badge-warning">🟡 Warning</span>';
}

function toast(msg, type = 'success') {
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    const icons = { success:'✅', error:'❌', info:'ℹ️' };
    t.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
    document.getElementById('toast-container').appendChild(t);
    setTimeout(() => { t.classList.add('hide'); setTimeout(() => t.remove(), 400); }, 2800);
}

function ts() {
    return new Date().toLocaleString('th-TH', { hour12: false }).replace(',', '');
}

// ─── Stats ────────────────────────────────────────────────────────────────────
function renderStats() {
    const total   = sites.length;
    const online  = sites.filter(s => s.status === 'online').length;
    const offline = sites.filter(s => s.status === 'offline').length;
    const warning = sites.filter(s => s.status === 'warning').length;
    document.getElementById('stats-row').innerHTML = `
        <div class="stat-card"><div class="stat-ico">🗂️</div><div><div class="stat-label">ไซต์ทั้งหมด</div><div class="stat-val cyan">${total}</div></div></div>
        <div class="stat-card"><div class="stat-ico">🟢</div><div><div class="stat-label">Online</div><div class="stat-val green">${online}</div></div></div>
        <div class="stat-card"><div class="stat-ico">🔴</div><div><div class="stat-label">Offline</div><div class="stat-val red">${offline}</div></div></div>
        <div class="stat-card"><div class="stat-ico">🟡</div><div><div class="stat-label">Warning</div><div class="stat-val yellow">${warning}</div></div></div>
    `;
}

// ─── Table ────────────────────────────────────────────────────────────────────
function getFiltered() {
    let data = [...sites];
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        data = data.filter(s =>
            s.site_id.toLowerCase().includes(q) ||
            s.site_name.toLowerCase().includes(q) ||
            s.location.toLowerCase().includes(q) ||
            s.type.toLowerCase().includes(q)
        );
    }
    if (filterStatus) data = data.filter(s => s.status === filterStatus);
    data.sort((a, b) => {
        const av = (a[sortKey] || '').toString().toLowerCase();
        const bv = (b[sortKey] || '').toString().toLowerCase();
        return sortAsc ? av.localeCompare(bv, 'th') : bv.localeCompare(av, 'th');
    });
    return data;
}

function sortTable(key) {
    if (sortKey === key) sortAsc = !sortAsc; else { sortKey = key; sortAsc = true; }
    render();
}

function render() {
    renderStats();
    const filtered = getFiltered();
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    if (currentPage > totalPages) currentPage = totalPages;
    const start = (currentPage - 1) * perPage;
    const page  = filtered.slice(start, start + perPage);

    const tbody = document.getElementById('table-body');
    const empty = document.getElementById('empty-state');

    if (page.length === 0) {
        tbody.innerHTML = '';
        empty.style.display = 'block';
    } else {
        empty.style.display = 'none';
        tbody.innerHTML = page.map((s, i) => `
            <tr id="row-${s.id}">
                <td style="color:var(--dim);">${start + i + 1}</td>
                <td style="font-weight:600; color:var(--cyan);">${s.site_id}</td>
                <td>${s.site_name}</td>
                <td style="color:var(--dim);">📍 ${s.location}</td>
                <td style="color:var(--dim);">${s.type}</td>
                <td>${statusBadge(s.status)}</td>
                <td style="font-family:monospace; font-size:13px; color:var(--dim);">${s.ip}</td>
                <td style="font-size:12px; color:var(--dim2);">${s.updated}</td>
                <td>
                    <div class="action-btns" style="justify-content:center;">
                        <button class="icon-btn view-btn" onclick="openViewModal(${s.id})" title="ดูรายละเอียด">👁️</button>
                        <button class="icon-btn edit-btn" onclick="openEditModal(${s.id})" title="แก้ไข">✏️</button>
                        <button class="icon-btn del-btn"  onclick="openConfirm(${s.id})"   title="ลบ">🗑️</button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    // Pagination info
    const from = total === 0 ? 0 : start + 1;
    const to   = Math.min(start + perPage, total);
    document.getElementById('paging-info').textContent = `แสดง ${from} – ${to} จาก ${total} รายการ`;

    // Page buttons
    const pb = document.getElementById('page-btns');
    pb.innerHTML = '';
    for (let p = 1; p <= totalPages; p++) {
        const btn = document.createElement('button');
        btn.className = 'page-btn' + (p === currentPage ? ' active' : '');
        btn.textContent = p;
        btn.onclick = () => { currentPage = p; render(); };
        pb.appendChild(btn);
    }
}

// ─── Add / Edit Modal ─────────────────────────────────────────────────────────
function openAddModal() {
    editingId = null;
    document.getElementById('modal-title').textContent = '➕ เพิ่มไซต์ใหม่';
    clearForm();
    document.getElementById('modal-form').classList.add('show');
}

function openEditModal(id) {
    const s = sites.find(x => x.id === id);
    if (!s) return;
    editingId = id;
    document.getElementById('modal-title').textContent = '✏️ แก้ไขไซต์';
    document.getElementById('f-site_id').value   = s.site_id;
    document.getElementById('f-site_name').value = s.site_name;
    document.getElementById('f-location').value  = s.location;
    document.getElementById('f-type').value      = s.type;
    document.getElementById('f-ip').value        = s.ip;
    document.getElementById('f-status').value    = s.status;
    document.getElementById('f-contact').value   = s.contact;
    document.getElementById('f-voltage').value   = s.voltage;
    document.getElementById('f-note').value      = s.note;
    document.getElementById('modal-form').classList.add('show');
}

function closeFormModal() {
    document.getElementById('modal-form').classList.remove('show');
}

function clearForm() {
    ['f-site_id','f-site_name','f-location','f-ip','f-contact','f-note'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('f-type').value    = 'อาคารสำนักงาน';
    document.getElementById('f-status').value  = 'online';
    document.getElementById('f-voltage').value = '220';
}

function saveRecord() {
    const site_id   = document.getElementById('f-site_id').value.trim();
    const site_name = document.getElementById('f-site_name').value.trim();
    if (!site_id || !site_name) { toast('กรุณากรอกรหัสไซต์และชื่อไซต์', 'error'); return; }

    const payload = {
        site_id, site_name,
        location : document.getElementById('f-location').value.trim() || '-',
        type     : document.getElementById('f-type').value,
        ip       : document.getElementById('f-ip').value.trim() || '-',
        status   : document.getElementById('f-status').value,
        contact  : document.getElementById('f-contact').value.trim(),
        voltage  : parseFloat(document.getElementById('f-voltage').value) || 220,
        note     : document.getElementById('f-note').value.trim(),
        updated  : ts(),
    };

    if (editingId) {
        const idx = sites.findIndex(s => s.id === editingId);
        sites[idx] = { ...sites[idx], ...payload };
        toast(`อัปเดต ${site_name} เรียบร้อยแล้ว`, 'success');
    } else {
        // Duplicate check
        if (sites.find(s => s.site_id.toLowerCase() === site_id.toLowerCase())) {
            toast('รหัสไซต์นี้มีอยู่แล้ว', 'error'); return;
        }
        sites.push({ id: nextId++, ...payload });
        toast(`เพิ่ม ${site_name} เรียบร้อยแล้ว`, 'success');
    }

    closeFormModal();
    render();
}

// ─── Delete ───────────────────────────────────────────────────────────────────
function openConfirm(id) {
    const s = sites.find(x => x.id === id);
    deletingId = id;
    document.getElementById('confirm-name').textContent = s ? `${s.site_id} – ${s.site_name}` : '';
    document.getElementById('modal-confirm').classList.add('show');
}

function closeConfirm() {
    document.getElementById('modal-confirm').classList.remove('show');
    deletingId = null;
}

function confirmDelete() {
    const s = sites.find(x => x.id === deletingId);
    sites = sites.filter(x => x.id !== deletingId);
    closeConfirm();
    toast(`ลบ ${s ? s.site_name : ''} แล้ว`, 'info');
    render();
}

// ─── View Modal ───────────────────────────────────────────────────────────────
function openViewModal(id) {
    const s = sites.find(x => x.id === id);
    if (!s) return;
    viewingId = id;
    const row = (label, val, style='') =>
        `<div style="display:flex; padding:10px 0; border-bottom:1px solid var(--border-color); ${style}">
            <div style="width:160px; color:var(--dim); font-size:13px; flex-shrink:0;">${label}</div>
            <div style="font-size:14px;">${val}</div>
         </div>`;
    document.getElementById('view-content').innerHTML =
        row('รหัสไซต์', `<span style="color:var(--cyan); font-weight:700;">${s.site_id}</span>`) +
        row('ชื่อไซต์', s.site_name) +
        row('สถานที่', `📍 ${s.location}`) +
        row('ประเภท', s.type) +
        row('สถานะ', statusBadge(s.status)) +
        row('IP Address', `<code style="color:var(--dim);">${s.ip}</code>`) +
        row('เบอร์ฉุกเฉิน', s.contact || '-') +
        row('แรงดันไฟฟ้า', `${s.voltage} V`) +
        row('หมายเหตุ', s.note || '-') +
        row('อัปเดตล่าสุด', `<span style="color:var(--dim2); font-size:12px;">${s.updated}</span>`, 'border:none;');
    document.getElementById('modal-view').classList.add('show');
}

function closeViewModal() {
    document.getElementById('modal-view').classList.remove('show');
    viewingId = null;
}

function editFromView() {
    closeViewModal();
    if (viewingId !== null) openEditModal(viewingId);
}

// ─── Clock ────────────────────────────────────────────────────────────────────
function updateClock() {
    const now = new Date();
    document.getElementById('clock').textContent = now.toLocaleString('th-TH', { hour12: false });
    document.getElementById('sync-badge').textContent = `● เชื่อมต่อแล้ว (${now.toLocaleTimeString('th-TH')})`;
}
setInterval(updateClock, 1000);
updateClock();

// ─── Search / Filter ──────────────────────────────────────────────────────────
document.getElementById('search-input').addEventListener('input', e => {
    searchQuery = e.target.value;
    currentPage = 1;
    render();
});
document.getElementById('filter-status').addEventListener('change', e => {
    filterStatus = e.target.value;
    currentPage = 1;
    render();
});

// Close modal on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
        if (e.target === overlay) {
            overlay.classList.remove('show');
            deletingId = null;
            viewingId  = null;
        }
    });
});

// ─── Init ─────────────────────────────────────────────────────────────────────
render();
</script>
</body>
</html>
