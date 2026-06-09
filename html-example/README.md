# SITE-03 Production Dashboard (PHP + MySQL)

โปรเจกต์นี้เป็นเวอร์ชัน production-ready scaffold ที่ออกแบบให้หน้าตาใกล้กับภาพอ้างอิงมากที่สุด พร้อมโครงสร้างแยกหน้า, API, login, session, CSRF, export CSV และ dashboard แบบ realtime polling

## ฟีเจอร์
- UI dark neon ใกล้ภาพอ้างอิง
- Login / Logout
- Dashboard การ์ด gauge 4 ตัว
- Trend chart เลือก metric + ช่วงเวลา
- Data report พร้อม pagination
- Export CSV
- โครงสร้างแยกส่วน พร้อมต่อยอด production ได้

## ความต้องการระบบ
- PHP 8.1+
- MySQL 8+ หรือ MariaDB 10.6+
- Apache / Nginx

## ติดตั้ง
1. สร้างฐานข้อมูลโดย import `sql/site_monitoring.sql`
2. แก้ค่าฐานข้อมูลใน `config/app.php`
3. วางโฟลเดอร์ใน web root เช่น `htdocs/site03_production`
4. เปิด `http://localhost/site03_production/auth/login.php`

## บัญชีเริ่มต้น
- Username: `admin`
- Password: `Admin@123`

## หมายเหตุ
- รหัสผ่านเริ่มต้นถูก hash ไว้แล้ว
- ถ้าต้องการ realtime จริงระดับ production แนะนำต่อ MQTT / WebSocket / Redis / queue
- ถ้าต้องการ export PDF/Excel, role management, audit log, multi-site, sensor mapping, alert notification สามารถต่อเพิ่มได้
