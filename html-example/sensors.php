<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>เซ็นเซอร์เพิ่มเติม | Electrical Monitoring</title>
    <meta name="description" content="หน้าจัดการเซ็นเซอร์ — เพิ่ม แก้ไข ลบ เซ็นเซอร์ (CRUD Mockup)">
    <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700&display=swap" rel="stylesheet">
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
        .sidebar{width:260px;background:var(--bg-card);border-right:1px solid var(--border-color);display:flex;flex-direction:column;padding:15px;flex-shrink:0;}
        .btn-site{background:none;border:1px solid var(--cyan);color:var(--cyan);width:100%;padding:10px;border-radius:6px;cursor:pointer;font-size:16px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:10px;transition:background .2s;}
        .btn-site:hover{background:var(--cyan-glow);}
        .btn-site-wrapper{margin-bottom:25px;border:1px solid #444;border-radius:8px;padding:10px;}
        .nav-group{border:1px solid var(--border-color);border-radius:8px;padding:8px;}
        .nav-item{display:flex;align-items:center;padding:11px 12px;color:var(--dim);text-decoration:none;border-radius:6px;margin-bottom:3px;font-size:14px;transition:background .2s,color .2s;}
        .nav-item:hover{background:rgba(255,255,255,.05);color:var(--text);}
        .nav-item.active{background:var(--cyan-glow);color:var(--cyan);border-left:3px solid var(--cyan);}
        .nav-item span{margin-right:10px;font-size:16px;}
        .main-content{flex:1;overflow-y:auto;padding:25px;}
        .page-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:22px;}
        .page-title{color:var(--cyan);font-size:22px;}
        .breadcrumb{font-size:12px;color:var(--dim);margin-top:5px;}
        .breadcrumb span{color:var(--yellow);}
        .header-right{text-align:right;}
        #clock{font-size:15px;font-weight:600;}
        .sync-badge{border:1px solid var(--cyan);color:var(--cyan);padding:4px 12px;border-radius:20px;font-size:12px;margin-top:8px;display:inline-block;}
        .toolbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;gap:12px;flex-wrap:wrap;}
        .search-box{position:relative;flex:1;max-width:340px;}
        .search-box input{width:100%;background:var(--bg-card);border:1px solid var(--border-color);color:var(--text);padding:9px 12px 9px 36px;border-radius:8px;font-size:14px;outline:none;transition:border .25s;}
        .search-box input:focus{border-color:var(--cyan);}
        .search-box .ico{position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--dim);font-size:15px;}
        .btn{padding:9px 18px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;border:none;transition:opacity .2s,transform .1s;display:inline-flex;align-items:center;gap:6px;}
        .btn:active{transform:scale(.97);}
        .btn-primary{background:var(--cyan);color:#000;}
        .btn-primary:hover{opacity:.85;}
        .btn-danger{background:var(--red);color:#000;}
        .btn-secondary{background:var(--bg-card);border:1px solid var(--border-color);color:var(--text);}
        .btn-secondary:hover{border-color:var(--cyan);}
        .card{background:var(--bg-card);border:1px solid var(--border-color);border-radius:12px;padding:20px;overflow:hidden;}
        .table-responsive{overflow-x:auto;}
        table{width:100%;border-collapse:collapse;font-size:13.5px;}
        thead th{background:rgba(34,211,238,.06);color:var(--dim);padding:13px 16px;text-align:left;font-weight:600;border-bottom:1px solid var(--border-color);white-space:nowrap;}
        tbody tr{transition:background .15s;}
        tbody tr:hover{background:rgba(255,255,255,.03);}
        tbody td{padding:13px 16px;border-bottom:1px solid var(--border-color);vertical-align:middle;}
        tbody tr:last-child td{border-bottom:none;}
        .badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;}
        .badge-online{background:rgba(74,222,128,.15);color:var(--green);border:1px solid rgba(74,222,128,.3);}
        .badge-offline{background:rgba(248,113,113,.15);color:var(--red);border:1px solid rgba(248,113,113,.3);}
        .badge-warning{background:rgba(250,204,21,.15);color:var(--yellow);border:1px solid rgba(250,204,21,.3);}
        .action-btns{display:flex;gap:8px;justify-content:center;}
        .icon-btn{background:none;border:1px solid var(--border-color);color:var(--dim);width:32px;height:32px;border-radius:6px;cursor:pointer;font-size:14px;display:inline-flex;align-items:center;justify-content:center;transition:all .2s;}
        .icon-btn:hover.edit-btn{border-color:var(--cyan);color:var(--cyan);background:var(--cyan-glow);}
        .icon-btn:hover.del-btn{border-color:var(--red);color:var(--red);background:rgba(248,113,113,.1);}
        .icon-btn:hover.view-btn{border-color:var(--green);color:var(--green);background:rgba(74,222,128,.1);}
        .pagination{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;font-size:13px;color:var(--dim);border-top:1px solid var(--border-color);}
        .page-btns{display:flex;gap:5px;}
        .page-btn{background:var(--bg-input);border:1px solid var(--border-color);color:var(--text);width:30px;height:30px;border-radius:6px;cursor:pointer;font-size:13px;display:inline-flex;align-items:center;justify-content:center;transition:all .2s;}
        .page-btn.active{background:var(--cyan);color:#000;border-color:var(--cyan);font-weight:700;}
        .page-btn:hover:not(.active){border-color:var(--cyan);color:var(--cyan);}
        #toast-container{position:fixed;bottom:24px;right:24px;z-index:2000;display:flex;flex-direction:column;gap:10px;}
        .toast{background:var(--bg-card);border:1px solid var(--border-color);border-radius:10px;padding:13px 18px;font-size:14px;display:flex;align-items:center;gap:10px;min-width:250px;box-shadow:0 8px 24px rgba(0,0,0,.4);animation:slideInR .3s ease;transition:opacity .4s,transform .4s;}
        .toast.hide{opacity:0;transform:translateX(30px);}
        .toast.success{border-left:3px solid var(--green);}
        .toast.info{border-left:3px solid var(--cyan);}
        @keyframes slideInR{from{opacity:0;transform:translateX(30px);}to{opacity:1;transform:translateX(0);}}
        /* Modal styles */
        .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.7);backdrop-filter:blur(4px);display:none;align-items:center;justify-content:center;z-index:1000;}
        .modal-overlay.show{display:flex;animation:fadeIn .2s ease;}
        @keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
        .modal{background:var(--bg-card);border:1px solid var(--border-color);border-radius:14px;padding:28px;width:100%;max-width:560px;max-height:90vh;overflow-y:auto;box-shadow:0 25px 60px rgba(0,0,0,.5);}
        .modal-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:22px;}
        .modal-title{font-size:18px;font-weight:700;color:var(--cyan);}
        .modal-close{background:none;border:none;color:var(--dim);font-size:22px;cursor:pointer;line-height:1;transition:color .2s;}
        .modal-close:hover{color:var(--text);}
        .form-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
        .form-group{margin-bottom:4px;}
        .form-group.full{grid-column:span 2;}
        .form-group label{display:block;font-size:12px;color:var(--dim);margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;}
        .form-group input,.form-group select,.form-group textarea{width:100%;padding:10px 12px;background:var(--bg-input);border:1px solid var(--border-color);color:var(--text);border-radius:8px;font-size:14px;outline:none;transition:border .25s;}
        .form-group input:focus,.form-group select:focus,.form-group textarea:focus{border-color:var(--cyan);}
        .modal-footer{display:flex;justify-content:flex-end;gap:10px;margin-top:22px;}


    </style>
</head>
<body>
    <!-- Sidebar -->
    <aside class="sidebar">
        <div class="btn-site-wrapper"><button class="btn-site">🏠 SITE</button></div>
        <div class="nav-group">
            <a href="index.php"   class="nav-item"><span>📊</span> แดชบอร์ดหลัก</a>
            <a href="sites.php"   class="nav-item"><span>🗂️</span> จัดการไซต์</a>
            <a href="reports.php" class="nav-item"><span>📄</span> รายงาน</a>
            <a href="settings.php"class="nav-item"><span>⚙️</span> ตั้งค่าไซต์</a>
            <a href="sensors.php" class="nav-item active"><span>➕</span> เซ็นเซอร์เพิ่มเติม</a>
        </div>
    </aside>
    <!-- Main -->
    <main class="main-content">
        <div class="page-header">
            <div>
                <h2 class="page-title">เซ็นเซอร์เพิ่มเติม (Sensor Management)</h2>
                <div class="breadcrumb">หน้าหลัก / <span>เซ็นเซอร์เพิ่มเติม</span></div>
            </div>
            <div class="header-right">
                <div id="clock">--:--:--</div>
                <div style="font-size:13px;color:var(--dim);margin-top:4px;">Admin User | สิทธิ์: เต็ม</div>
                <div class="sync-badge" id="sync-badge">● เชื่อมต่อแล้ว</div>
            </div>
        </div>
        <div class="toolbar">
            <div class="search-box">
                <span class="ico">🔍</span>
                <input type="text" id="search-input" placeholder="ค้นหาเซ็นเซอร์ (ชื่อ, ID, ประเภท...)">
            </div>
            <button class="btn btn-primary" id="btn-add" onclick="openAddModal()">➕ เพิ่มเซ็นเซอร์</button>
        </div>
        <div class="card">
            <div class="table-responsive">
                <table id="sensor-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>รหัสเซ็นเซอร์</th>
                            <th>ชื่อเซ็นเซอร์</th>
                            <th>ประเภท</th>
                            <th>สถานะ</th>
                            <th>ไซต์ที่เชื่อมต่อ</th>
                            <th style="text-align:center;">จัดการ</th>
                        </tr>
                    </thead>
                    <tbody id="table-body"></tbody>
                </table>
            </div>
            <div id="empty-state" class="empty-state" style="display:none;">
                <div class="ico">🔌</div>
                <div>ไม่มีเซ็นเซอร์ในระบบ</div>
            </div>
            <div class="pagination" id="pagination">
                <div id="paging-info"></div>
                <div class="page-btns" id="page-btns"></div>
            </div>
        </div>
    </main>
    <!-- Add / Edit Modal -->
    <div class="modal-overlay" id="modal-form">
        <div class="modal">
            <div class="modal-header">
                <div class="modal-title" id="modal-title">➕ เพิ่มเซ็นเซอร์ใหม่</div>
                <button class="modal-close" onclick="closeFormModal()">✕</button>
            </div>
            <div class="form-grid">
                <div class="form-group"><label>รหัสเซ็นเซอร์ *</label><input type="text" id="f-id" placeholder="เช่น SENS-01"></div>
                <div class="form-group"><label>ชื่อเซ็นเซอร์ *</label><input type="text" id="f-name" placeholder="เช่น Voltage Sensor"></div>
                <div class="form-group"><label>ประเภท</label><select id="f-type"><option>Voltage</option><option>Current</option><option>Power</option><option>Temperature</option></select></div>
                <div class="form-group"><label>สถานะ</label><select id="f-status"><option value="online">🟢 Online</option><option value="offline">🔴 Offline</option><option value="warning">🟡 Warning</option></select></div>
                <div class="form-group full"><label>ไซต์ที่เชื่อมต่อ</label><input type="text" id="f-site" placeholder="เช่น SITE-03"></div>
                <div class="form-group full"><label>หมายเหตุ</label><textarea id="f-note" placeholder="รายละเอียดเพิ่มเติม..." rows="2"></textarea></div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeFormModal()">ยกเลิก</button>
                <button class="btn btn-primary" onclick="saveRecord()">💾 บันทึก</button>
            </div>
        </div>
    </div>
    <!-- Delete Confirm Modal -->
    <div class="modal-overlay" id="modal-confirm">
        <div class="modal confirm-modal">
            <div class="confirm-icon" style="font-size:48px;">🗑️</div>
            <h3 style="color:var(--text);margin:12px 0;">ยืนยันการลบ</h3>
            <p class="confirm-text" style="color:var(--dim);font-size:14px;">คุณแน่ใจหรือไม่ที่จะลบเซ็นเซอร์ <strong id="confirm-name" style="color:var(--red);"></strong>?</p>
            <div class="modal-footer" style="justify-content:center;margin-top:18px;">
                <button class="btn btn-secondary" onclick="closeConfirm()">ยกเลิก</button>
                <button class="btn btn-danger" onclick="confirmDelete()">ลบเลย</button>
            </div>
        </div>
    </div>

    </div>

    <!-- View Modal -->
    <div class="modal-overlay" id="modal-view">
        <div class="modal">
            <div class="modal-header">
                <div class="modal-title">👁️ ดูเซ็นเซอร์</div>
                <button class="modal-close" onclick="closeViewModal()">✕</button>
            </div>
            <div id="view-content"></div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeViewModal()">ปิด</button>
            </div>
        </div>
    </div>

    <div id="toast-container"></div>
    <script>
        // Mock sensor data
        let sensors = [
            {id:1, sensor_id:'SENS-01', name:'Voltage Sensor A', type:'Voltage', status:'online', site:'SITE-01', note:'', updated:ts()},
            {id:2, sensor_id:'SENS-02', name:'Current Sensor B', type:'Current', status:'warning', site:'SITE-02', note:'ค่าเกินขีดจำกัด', updated:ts()},
            {id:3, sensor_id:'SENS-03', name:'Power Sensor C', type:'Power', status:'offline', site:'SITE-03', note:'เชื่อมต่อไม่ได้', updated:ts()},
            {id:4, sensor_id:'SENS-04', name:'Temp Sensor D', type:'Temperature', status:'online', site:'SITE-01', note:'', updated:ts()},
            {id:5, sensor_id:'SENS-05', name:'Voltage Sensor E', type:'Voltage', status:'online', site:'SITE-04', note:'', updated:ts()},
        ];
        let nextId = 6;
        // State variables
        let editingId = null;
        let deletingId = null;
        let searchQuery = '';
        let currentPage = 1;
        const perPage = 5;
        // Helpers
        function ts(){ return new Date().toLocaleString('th-TH', {hour12:false}); }
        function statusBadge(s){ if(s==='online') return '<span class="badge badge-online">🟢 Online</span>'; if(s==='offline') return '<span class="badge badge-offline">🔴 Offline</span>'; return '<span class="badge badge-warning">🟡 Warning</span>'; }
        function toast(msg,type='success'){ const icons={success:'✅',info:'ℹ️',error:'❌'}; const t=document.createElement('div'); t.className=`toast ${type}`; t.innerHTML=`<span>${icons[type]}</span><span>${msg}</span>`; document.getElementById('toast-container').appendChild(t); setTimeout(()=>{ t.classList.add('hide'); setTimeout(()=>t.remove(),400); },2800); }
        // Render table
        function getFiltered(){ let data=[...sensors]; if(searchQuery){ const q=searchQuery.toLowerCase(); data=data.filter(s=>s.sensor_id.toLowerCase().includes(q)||s.name.toLowerCase().includes(q)||s.type.toLowerCase().includes(q)||s.site.toLowerCase().includes(q)); } return data; }
        function render(){ const filtered=getFiltered(); const total=filtered.length; const totalPages=Math.max(1,Math.ceil(total/perPage)); if(currentPage>totalPages) currentPage=totalPages; const start=(currentPage-1)*perPage; const page=filtered.slice(start,start+perPage);
            const tbody=document.getElementById('table-body'); const empty=document.getElementById('empty-state');
            if(page.length===0){ tbody.innerHTML=''; empty.style.display='block'; }
            else{ empty.style.display='none'; tbody.innerHTML=page.map((s,i)=>`
                <tr>
                    <td style="color:var(--dim2);">${start+i+1}</td>
                    <td style="color:var(--cyan);font-weight:600;">${s.sensor_id}</td>
                    <td>${s.name}</td>
                    <td>${s.type}</td>
                    <td>${statusBadge(s.status)}</td>
                    <td>${s.site}</td>
                    <td>
                        <div class="action-btns">
                            <button class="icon-btn view-btn" onclick="openViewModal(${s.id})" title="ดู">👁️</button>
                            <button class="icon-btn edit-btn" onclick="openEditModal(${s.id})" title="แก้ไข">✏️</button>
                            <button class="icon-btn del-btn" onclick="openConfirm(${s.id})" title="ลบ">🗑️</button>
                        </div>
                    </td>
                </tr>
            `).join(''); }
            const from=total===0?0:start+1; const to=Math.min(start+perPage,total);
            document.getElementById('paging-info').textContent=`แสดง ${from} – ${to} จาก ${total} รายการ`;
            const pb=document.getElementById('page-btns'); pb.innerHTML=''; for(let p=1;p<=totalPages;p++){
                const btn=document.createElement('button'); btn.className='page-btn'+(p===currentPage?' active':''); btn.textContent=p; btn.onclick=()=>{ currentPage=p; render(); }; pb.appendChild(btn);
            }
        }
        // Search
        document.getElementById('search-input').addEventListener('input',e=>{ searchQuery=e.target.value; currentPage=1; render(); });
        // Modal functions
        function openAddModal(){ editingId=null; document.getElementById('modal-title').textContent='➕ เพิ่มเซ็นเซอร์ใหม่'; clearForm(); document.getElementById('modal-form').classList.add('show'); }
        function openEditModal(id){ const s=sensors.find(x=>x.id===id); if(!s) return; editingId=id; document.getElementById('modal-title').textContent='✏️ แก้ไขเซ็นเซอร์'; document.getElementById('f-id').value=s.sensor_id; document.getElementById('f-name').value=s.name; document.getElementById('f-type').value=s.type; document.getElementById('f-status').value=s.status; document.getElementById('f-site').value=s.site; document.getElementById('f-note').value=s.note; document.getElementById('modal-form').classList.add('show'); }
        function closeFormModal(){ document.getElementById('modal-form').classList.remove('show'); }
        function clearForm(){ ['f-id','f-name','f-site','f-note'].forEach(id=>document.getElementById(id).value=''); document.getElementById('f-type').value='Voltage'; document.getElementById('f-status').value='online'; }
        function saveRecord(){ const sensor_id=document.getElementById('f-id').value.trim(); const name=document.getElementById('f-name').value.trim(); if(!sensor_id||!name){ toast('กรุณากรอกรหัสและชื่อเซ็นเซอร์', 'error'); return; }
            const payload={ sensor_id, name, type:document.getElementById('f-type').value, status:document.getElementById('f-status').value, site:document.getElementById('f-site').value.trim()||'-', note:document.getElementById('f-note').value.trim(), updated:ts() };
            if(editingId){ const idx=sensors.findIndex(s=>s.id===editingId); sensors[idx]={...sensors[idx],...payload}; toast('อัปเดตเซ็นเซอร์เรียบร้อย', 'success'); }
            else{ if(sensors.find(s=>s.sensor_id.toLowerCase()===sensor_id.toLowerCase())){ toast('รหัสเซ็นเซอร์นี้มีอยู่แล้ว', 'error'); return; } sensors.push({id:nextId++,...payload}); toast('เพิ่มเซ็นเซอร์เรียบร้อย', 'success'); }
            closeFormModal(); render(); }
        // Delete flow
        function openConfirm(id){ const s=sensors.find(x=>x.id===id); deletingId=id; document.getElementById('confirm-name').textContent=`${s.sensor_id} – ${s.name}`; document.getElementById('modal-confirm').classList.add('show'); }
        function closeConfirm(){ document.getElementById('modal-confirm').classList.remove('show'); deletingId=null; }
        function confirmDelete(){ sensors=sensors.filter(x=>x.id!==deletingId); closeConfirm(); toast('ลบเซ็นเซอร์แล้ว', 'info'); render(); }

        // View modal
        function openViewModal(id){
            const s = sensors.find(x=>x.id===id);
            if(!s) return;
            document.getElementById('view-content').innerHTML = `
                <div class="form-grid">
                    <div class="form-group"><label>รหัสเซ็นเซอร์</label><input type="text" value="${s.sensor_id}" readonly style="background:var(--bg-card);"></div>
                    <div class="form-group"><label>ชื่อเซ็นเซอร์</label><input type="text" value="${s.name}" readonly style="background:var(--bg-card);"></div>
                    <div class="form-group"><label>ประเภท</label><input type="text" value="${s.type}" readonly style="background:var(--bg-card);"></div>
                    <div class="form-group"><label>สถานะ</label><input type="text" value="${s.status === 'online' ? '🟢 Online' : s.status === 'offline' ? '🔴 Offline' : '🟡 Warning'}" readonly style="background:var(--bg-card);"></div>
                    <div class="form-group full"><label>ไซต์ที่เชื่อมต่อ</label><input type="text" value="${s.site}" readonly style="background:var(--bg-card);"></div>
                    <div class="form-group full"><label>หมายเหตุ</label><textarea readonly rows="2" style="background:var(--bg-card);">${s.note}</textarea></div>
                </div>
            `;
            document.getElementById('modal-view').classList.add('show');
        }
        function closeViewModal(){
            document.getElementById('modal-view').classList.remove('show');
        }
        // Clock & sync badge
        function updateClock(){ const now=new Date(); document.getElementById('clock').textContent=now.toLocaleString('th-TH',{hour12:false}); document.getElementById('sync-badge').textContent=`● เชื่อมต่อแล้ว (${now.toLocaleTimeString('th-TH')})`; }
        setInterval(updateClock,1000); updateClock();
        // Init
        render();
    </script>
</body>
</html>
