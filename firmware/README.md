# Firmware

Firmware สำหรับบอร์ด **HKL-EA8 (Hankerila / ESP32-WROOM-32E)** ที่อ่านค่าจาก
**PZEM-004T** (TTL ผ่าน HMI port) และ/หรือ **KWS-AC301L** (RS485 A/B)
แล้วส่งเข้า MQTT broker ของ LED Wall Monitor

## ตัวจริงที่ใช้งาน — [pzem_mqtt/](pzem_mqtt)

| Sketch | ใช้ตอนไหน |
|---|---|
| [pzem_mqtt/](pzem_mqtt) | **Production** — รองรับทั้ง PZEM + KWS ในตัวเดียว |
| [pzem_pinfinder/](pzem_pinfinder) | Diagnostic — สแกนหา GPIO ของ HMI port (ใช้ครั้งเดียว ตอน setup บอร์ดใหม่ที่ pinout ไม่ทราบ) |
| [kws_finder/](kws_finder) | Diagnostic — สแกนหา slave address + baud + function code ของ KWS |
| [kws_dump/](kws_dump) | Diagnostic — อ่าน register raw ของ KWS เพื่อแกะ register map |

ถ้าใช้บอร์ด HKL-EA8 + PZEM + KWS เหมือนกัน — ใช้ `pzem_mqtt/` ตรง ๆ ไม่ต้องสแกน

## ไฟล์ใน production sketch

```
pzem_mqtt/
├── pzem_mqtt.ino        ← main sketch
├── secrets.h            ← WiFi/MQTT credentials (gitignored - ไม่ขึ้น git)
└── secrets.example.h    ← template สำหรับใช้ก็อปไป
```

## ติดตั้งบนบอร์ดใหม่

### 1. ติดตั้ง Arduino IDE + ESP32 core
1. ติดตั้ง [Arduino IDE 2.x](https://www.arduino.cc/en/software)
2. **File → Preferences → Additional Board Manager URLs**:
   ```
   https://espressif.github.io/arduino-esp32/package_esp32_index.json
   ```
3. **Tools → Board Manager** → ค้น `esp32` → ติดตั้ง `esp32 by Espressif Systems`
4. **Tools → Board → ESP32 Arduino → ESP32 Dev Module**
5. ตั้งค่าใน Tools:
   - **Flash Size**: `16MB (128Mb)`
   - **Upload Speed**: `921600`
   - **Partition Scheme**: `Default 4MB with spiffs`

### 2. ติดตั้ง libraries
**Tools → Manage Libraries** → ค้นและติดตั้ง:
- `PZEM004Tv30` (Jakub Mandula)
- `ModbusMaster` (4-20ma)
- `PubSubClient` (Nick O'Leary)
- `ArduinoJson` (Benoit Blanchon)

### 3. ก็อป + แก้ค่าให้ตรงกับบอร์ดใหม่

```bash
# ก็อปทั้งโฟลเดอร์ pzem_mqtt/ ไปใช้
cp -r pzem_mqtt/ pzem_mqtt_board2/
```

**3a. สร้าง `secrets.h`** จากตัวอย่าง:
```bash
cp pzem_mqtt_board2/secrets.example.h pzem_mqtt_board2/secrets.h
```
แล้วแก้:
```cpp
#define SECRET_WIFI_SSID     "ชื่อ WiFi ของไซต์"
#define SECRET_WIFI_PASSWORD "รหัส WiFi"
#define SECRET_MQTT_HOST     "IP ของ broker (PC/server)"
#define SECRET_MQTT_PORT     11883          // dev = 11883, prod = 1883
#define SECRET_MQTT_USERNAME ""              // ว่างถ้า broker เปิด anonymous
#define SECRET_MQTT_PASSWORD ""
```

**3b. แก้ใน `pzem_mqtt.ino`** ส่วน User configuration:
```cpp
const char* SITE_CODE        = "SITE-001";   // ← ต้องตรงกับใน DB
const char* BOARD_CODE       = "BOARD-002";  // ← เปลี่ยนทุกบอร์ดให้ unique!
const char* SENSOR_PZEM_CODE = "PZEM-002";   // ← ตามที่ register ไว้
const char* SENSOR_KWS_CODE  = "KWS-002";    // ← ตามที่ register ไว้
```

> ⚠️ **ห้ามใช้ BOARD_CODE ซ้ำกัน** — broker จะตัด client เก่าออก ทำให้ทั้งคู่ขาดสลับกันไม่หยุด

### 4. Register บอร์ด + sensor ใน UI
ก่อน Upload firmware ให้:
1. Login เข้า frontend (admin/admin1234)
2. **จัดการอุปกรณ์ → เพิ่มบอร์ด** → ใส่ code = `BOARD-002` + เลือก site
3. คลิกเข้า BOARD-002 → **เพิ่มเซ็นเซอร์** → เลือก PZEM/KWS

### 5. Upload
- ต่อสาย Type-C จากบอร์ดเข้าคอม
- **Tools → Port** → เลือก COM ที่ขึ้นมา
- กดปุ่ม **Upload**

### 6. Verify
- เปิด **Tools → Serial Monitor** ที่ baud 115200
- ควรเห็น:
  ```
  WiFi: connected, IP=10.x.x.x
  MQTT: connected
  MQTT OK (state=0): {...}
  ```
- เปิด frontend → จัดการอุปกรณ์ → BOARD-002 → จะเห็นค่า LIVE

## Hardware wiring (HKL-EA8)

### PZEM-004T → HMI port
| ขั้ว HMI | ต่อกับ |
|---|---|
| 5V | PZEM VCC |
| GND | PZEM GND |
| TX | PZEM TX (cross — board software จะสลับให้) |
| RX | PZEM RX |

PZEM ฝั่ง AC: L → ขั้ว Live ของโหลด, N → Neutral, CT clamp คล้องสาย Line

### KWS-AC301L → RS485 A/B
| ขั้วบอร์ด | ต่อกับ KWS |
|---|---|
| A | A (485+) |
| B | B (485−) |

KWS ฝั่ง AC: L/N ต่อขั้ว Live/Neutral, CT คล้องสาย Line  
(*Auto-direction RS485 — ไม่ต้องต่อ DE/RE*)

## Pinout reference (HKL-EA8)

จาก [ESPHome devices page](https://devices.esphome.io/devices/hankerila-ea8/):

| Function | GPIO |
|---|---|
| HMI port (PZEM) | RX=15, TX=16 (board labels TX/RX ที่ขั้วต่อมาจาก board-perspective ต้องสลับ) |
| RS485 A/B (KWS) | RX=14, TX=13 (auto-direction, ไม่ต้องคุม DE/RE) |
| I2C | SDA=4, SCL=5 |
| Buzzer | GPIO 12 |
| IR | RX=33, TX=32 |
| Ethernet PHY | GPIO 17, 18, 23 (อย่าใช้ใน sketch) |

## MQTT payload schema

Topic:
```
sites/<SITE_CODE>/boards/<BOARD_CODE>/telemetry
```

Payload (JSON):
```json
{
  "boardCode": "BOARD-001",
  "firmware":  "v0.2.0",
  "ipAddress": "10.88.1.160",
  "sensors": {
    "PZEM-001": {
      "voltage": 229.8, "current": 0.088, "power": 7.3, "energy": 0.028,
      "raw": { "pf": 0.36, "frequency": 50 }
    },
    "KWS-001": {
      "voltage": 229.0, "current": 0.092, "power": 7.4, "energy": 0.026, "temperature": 30,
      "raw": { "pf": 0.33, "frequency": 50 }
    }
  }
}
```

## Calibration ที่ทำไปแล้ว (อย่าเปลี่ยนถ้าใช้รุ่นเดียวกัน)

**KWS-AC301L holding registers (function 0x03, slave addr 2, baud 9600):**
| Field | Register | Scale |
|---|---|---|
| Voltage | 0x000E | /10 → V |
| Current | 0x000F + 0x0010 | /1000 → A |
| Power | 0x0011 + 0x0012 | /10 → W |
| Energy | 0x0017 | **/1000 → kWh** (register in Wh) |
| External Temp | 0x001A | /1 → °C |
| Power Factor | 0x001D | /100 |
| Frequency | 0x001E | /10 → Hz |
