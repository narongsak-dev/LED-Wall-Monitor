# LED Wall Monitor — Board Firmware

Firmware สำหรับบอร์ด **HKL-EA8 (Hankerila / ESP32-WROOM-32E)** ที่อ่านค่าจาก
**PZEM-004T** (TTL ผ่าน HMI port) และ **KWS-AC301L** (RS485 A/B)
แล้วส่ง telemetry เข้า MQTT broker ของระบบ LED Wall Monitor

ปัจจุบันคือ **v0.10.5**

## ภาพรวมการทำงาน

1. **Boot** — บอร์ดอ่านค่า config จาก NVS, beep 1 ครั้ง
2. **เชื่อมต่อเครือข่าย** — พยายาม Ethernet ก่อน, ถ้าไม่มีสาย LAN → fallback เป็น WiFi
3. **เริ่ม Web UI + MQTT** — เปิด web dashboard ที่ `http://<ip>/` + เชื่อม MQTT broker
4. **Loop** — อ่าน PZEM + KWS ทุก 3 วินาที → publish ทาง MQTT, แสดงบน dashboard
5. **Beep 2 ครั้ง** เมื่อทุกอย่างพร้อม

## คุณสมบัติหลัก

### เครือข่าย
- **Ethernet (LAN8720 PHY)** — primary, plug-and-play DHCP
- **WiFi** — fallback อัตโนมัติเมื่อไม่มีสาย LAN
- **Static IP** หรือ **DHCP** เลือกได้
- **MQTT plaintext** หรือ **MQTTS/TLS** เลือกได้ (รองรับ CA cert verification)

### Real-time Web Dashboard (`http://<ip>/`)
- Status strip: Active Link · MQTT · Published count · Last Reading
- Sensor cards (PZEM + KWS): voltage, current, power, energy, temperature + PF/Freq
- System metrics: CPU usage %, RAM (heap), Flash (sketch) — progress bars สีตาม load
- TLS badge เมื่อเปิด MQTTS
- MQTT topic banner
- Auto-refresh ทุก 2 วินาที
- ปุ่ม Settings, Logout, Restart

### Config Portal (AP mode)
- กดปุ่ม **BOOT** ค้าง 3 วินาที (ทั้งตอนเปิดเครื่อง หรือขณะทำงาน) → เข้าโหมด portal
- บอร์ดปล่อย WiFi AP `DGH-Monitor-XXXX` (pass `012345678`)
- เปิด `http://192.168.4.1/` → form ตั้งค่าครบทุกอย่าง
- **Captive portal** — มือถือเด้งหน้า config อัตโนมัติเมื่อต่อ AP
- User/pass reset เป็น default ทุกครั้งที่เข้า portal (recovery path)

### Settings page (`http://<ip>/settings`)
- แก้ config เดียวกันกับ portal แต่ใช้บนเครือข่ายปกติ ไม่ต้องเข้า AP mode
- Sections: Identity · WiFi & Network · MQTT Broker · Login & Security

### เก็บค่า config (NVS)
ค่าต่อไปนี้เก็บใน flash ติดไปกับบอร์ด — ไม่ต้องแก้โค้ดเวลาตั้งค่าใหม่:
- WiFi SSID/Password
- MQTT Host, Port, User, Pass, **Topic** (custom หรือ default template), **TLS toggle**, **CA cert**
- Site code, Board code, Sensor codes, KWS slave address
- IP mode (DHCP/Static) + Static IP/Gateway/Subnet/DNS
- Config portal user/password + require-login toggle

### Audio feedback (Buzzer GPIO 12)
| สถานการณ์ | เสียง |
|---|---|
| Boot เริ่ม | บี๊บสั้น 1 ครั้ง |
| Boot เสร็จ Web UI + MQTT พร้อม | บี๊บสั้น 2 ครั้ง |
| Portal AP พร้อมใช้งาน | บี๊บยาว 1 ครั้ง (500 ms) |
| Portal heartbeat (ทุก 15s) | สั้น – ยาว – สั้น |
| กด BOOT ค้าง 3s ขณะทำงาน | บี๊บสั้น 3 ครั้ง → reboot เข้า portal |

### Reliability
- **Hardware watchdog** 30 วินาที — auto-restart ถ้า task ค้าง
- **Sensor reconnect recovery** — Drain UART RX buffer ก่อน read + auto re-init UART หลังอ่านผิด 5 ครั้งติด
- **MQTT auto-reconnect** ทุก 3 วินาที
- **FreeRTOS task split**: `sensorTask` (core 0) + `mqttTask` (core 1) — ไม่บล็อก
- **OTA update** ผ่าน ArduinoOTA (port 3232) — WDT detach ตอน flash เพื่อไม่ให้ reboot กลางทาง

## ไฟล์ใน sketch

```
firmware/pzem_mqtt/
├── pzem_mqtt.ino          ← main + sensorTask + mqttTask + dashboard HTML
├── portal.ino             ← AP-mode config portal (captive DNS + form)
├── config.h               ← Config struct + helper declarations
├── secrets.h              ← default credentials (gitignored)
└── secrets.example.h      ← template
```

## Hardware wiring (HKL-EA8)

### PZEM-004T → HMI port
| ขั้ว HMI | ต่อกับ PZEM |
|---|---|
| 5V | VCC |
| GND | GND |
| TX | TX (cross — software สลับ) |
| RX | RX |

PZEM ฝั่ง AC: L → Live ของโหลด, N → Neutral, CT clamp คล้องสาย Line

### KWS-AC301L → RS485 A/B
| ขั้วบอร์ด | ต่อกับ KWS |
|---|---|
| A | A (485+) |
| B | B (485−) |

KWS ฝั่ง AC: L/N ต่อ Live/Neutral, CT คล้องสาย Line  
(Auto-direction RS485 — ไม่ต้องคุม DE/RE)

### Ethernet
ใช้พอร์ต RJ45 บนบอร์ด — LAN8720 PHY ต่อ MDC=23, MDIO=18, CLK=GPIO17 OUT (in-built)

## Pinout reference (HKL-EA8)

| Function | GPIO |
|---|---|
| HMI port (PZEM) | RX=15, TX=16 (sketch สลับเป็น 16/15) |
| RS485 A/B (KWS) | RX=14, TX=13 (auto-direction) |
| I2C | SDA=4, SCL=5 |
| Buzzer | GPIO 12 |
| IR | RX=33, TX=32 |
| Ethernet PHY | GPIO 17 (CLK), 18 (MDIO), 23 (MDC), + RMII data 19/21/22/25/26/27 |
| BOOT button | GPIO 0 (INPUT_PULLUP) |

## First-time setup (บอร์ดใหม่)

### 1. Flash firmware ครั้งแรก (USB)

Arduino IDE 2.x + ESP32 core 3.x:
- Board: **ESP32 Dev Module**
- Flash Size: **16MB**
- Upload Speed: **921600**

Libraries ที่ต้องติดตั้ง:
- `PZEM004Tv30` (Jakub Mandula)
- `ModbusMaster` (4-20ma)
- `PubSubClient` (Nick O'Leary)
- `ArduinoJson` (Benoit Blanchon)

ก่อน compile ครั้งแรก: copy `secrets.example.h` → `secrets.h` แล้วใส่ default ที่ต้องการ (จะถูกใช้เฉพาะ first boot ก่อนที่ user จะตั้งค่าผ่าน portal)

### 2. เปิดเครื่อง → เข้า Portal

หลัง flash เสร็จบอร์ด boot ครั้งแรก, NVS ว่าง → ใช้ default จาก secrets.h
ถ้าต้องการตั้งค่าใหม่ทั้งหมด:

1. **กดปุ่ม BOOT ค้าง 3 วินาที** (จะได้ยินเสียงบี๊บ 3 ครั้ง → reboot เข้า portal)
2. รอบี๊บยาว 1 ครั้ง = AP พร้อม
3. มือถือ/notebook ต่อ WiFi `DGH-Monitor-XXXX` (pass `012345678`)
4. หน้า config จะเด้งขึ้นมาเอง (captive portal) หรือเปิด `http://192.168.4.1/`
5. Login: `dragon` / `dragon`
6. ใส่ค่า: WiFi, MQTT broker, Site/Board codes, sensor codes ฯลฯ
7. กด **Save & Reboot** → บอร์ดจะ reboot และต่อ WiFi/Ethernet ปกติ

### 3. หา IP ใหม่
- ดู Serial Monitor (115200 baud) — จะ print IP
- หรือ `http://<boardCode>.local/` (mDNS)
- หรือเช็คใน router DHCP table

## Recovery paths

**ลืม password เข้า web UI:**
- กด BOOT ค้าง 3s → reboot เข้า portal → user/pass reset เป็น default (`dragon`/`dragon`)

**WiFi/MQTT ตั้งผิด — เข้าบอร์ดไม่ได้:**
- เหมือนข้างบน → portal → แก้ใหม่

**Factory reset:**
- เข้า portal/settings → ปุ่ม **Factory Reset** → wipe NVS, กลับสู่ default ทั้งหมด

**MQTT broker ออฟไลน์:**
- บอร์ด retry connect ทุก 3 วินาที, sensorTask ยังอ่านค่าและแสดงบน dashboard ปกติ

**เซ็นเซอร์ถูกถอด/เสียบใหม่:**
- หลังเสียบกลับ ~15 วินาที firmware จะ re-init UART อัตโนมัติ → อ่านค่าต่อเอง

## MQTT payload schema

**Topic (default):**
```
sites/<SITE_CODE>/boards/<BOARD_CODE>/telemetry
```
หรือ custom topic ที่ตั้งในหน้า settings (ใช้แทน template เลย)

**Payload (JSON):**
```json
{
  "boardCode": "BOARD-001",
  "firmware":  "v0.10.5",
  "ipAddress": "10.88.1.178",
  "transport": "ethernet",
  "sensors": {
    "PZEM-001": {
      "voltage": 228.4, "current": 0.092, "power": 7.3, "energy": 0.286,
      "raw": { "pf": 0.34, "frequency": 50 }
    },
    "KWS-001": {
      "voltage": 227.4, "current": 0.099, "power": 7.4, "energy": 0.288, "temperature": 32,
      "raw": { "pf": 0.33, "frequency": 50 }
    }
  }
}
```

## Local API (`/api/status`)

GET พร้อม HTTP Basic Auth (เมื่อ requireLogin = true):

```json
{
  "boardCode": "BOARD-001",
  "siteCode":  "SITE-001",
  "firmware":  "v0.10.5",
  "transport": "ethernet|wifi|offline",
  "ipAddress": "10.88.1.178",
  "ethConnected": true, "ethGotIp": true, "ethIp": "...",
  "ethLinkMbps": 100, "ethFullDuplex": true,
  "wifiConnected": false, "wifiIp": "", "wifiSsid": "...", "rssi": -29,
  "mqttConnected": true, "mqttHost": "10.88.1.69:11883",
  "mqttTopic": "sites/.../telemetry", "mqttTls": false,
  "cpuFreqMhz": 240, "cpuUsagePct": 23.5,
  "heapTotal": 321112, "heapFree": 197368, "heapMinFree": 171064,
  "sketchSize": 1232432, "sketchFree": 1310720,
  "uptimeMs": 183483, "lastReadingAgoMs": 239,
  "totalPublishes": 60, "mqttFailures": 0,
  "pzem": { "code": "PZEM-001", "ok": true, "voltage": ..., "current": ..., "power": ..., "energy": ..., "pf": ..., "freq": ... },
  "kws":  { "code": "KWS-001",  "ok": true, "voltage": ..., "current": ..., "power": ..., "energy": ..., "temperature": ..., "pf": ..., "freq": ... }
}
```

## KWS-AC301L register map (calibrated)

Function 0x03 (read holding registers), baud 9600, slave addr default 2 (ปรับได้)

| Field | Register | Scale |
|---|---|---|
| Voltage | 0x000E | /10 → V |
| Current | 0x000F + 0x0010 | /1000 → A (32-bit, little-endian word order) |
| Power | 0x0011 + 0x0012 | /10 → W (32-bit) |
| Energy | 0x0017 | **/1000 → kWh** (register in Wh) |
| External Temp | 0x001A | /1 → °C (signed) |
| Power Factor | 0x001D | /100 |
| Frequency | 0x001E | /10 → Hz |

## OTA (Over-the-Air firmware update)

หลัง flash ครั้งแรกผ่าน USB v0.4.0+ แล้ว อัพเดทครั้งถัดไปทำผ่าน OTA ได้:

```powershell
.\scripts\upload-ota.ps1 -BoardIp 10.88.1.178 -Sketch firmware\pzem_mqtt
```

ข้อกำหนด:
- บอร์ดต้อง online + เครื่องที่ flash อยู่ใน LAN เดียวกัน
- ไม่ต้องตั้ง OTA password (เปิดให้ทุก client บน LAN เป็น default)

ระหว่าง OTA: bsensorTask ทำงานตามปกติ, mqttTask ปลด watchdog ชั่วคราว, MQTT publish ถูก pause จนกว่าจะ reboot

## Build size (อ้างอิง v0.10.5)

```
Sketch:        1.18 MB (94% of 1.31 MB sketch partition)
Global RAM:    55 KB (16% of 320 KB)
Free heap idle: ~193 KB
```

## หมายเหตุ

- **ห้ามใช้ Board code ซ้ำ** — MQTT broker จะตัด client ID เก่าออก ทำให้ขาดสลับกันไม่หยุด
- **GPIO 12 (Buzzer) เป็น strapping pin** — บอร์ดออกแบบให้ pin low ตอน reset, sketch แตะหลัง setup() เท่านั้น
- **CA cert PEM ขนาดสูงสุด ~2 KB** — เก็บใน NVS รวมกับ config blob (~3 KB total)
- **mDNS** ใช้ชื่อ `<boardCode>.local` — ต้องอยู่ใน LAN เดียวกัน + เครื่อง client รองรับ mDNS
