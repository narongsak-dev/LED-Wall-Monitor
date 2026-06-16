/*
 * Board firmware for LED Wall Monitor — HKL-EA8 (Hankerila / ESP32-WROOM-32E)
 *
 * Features
 *   - PZEM-004T via HMI port (Serial1, GPIO 16 RX / 15 TX, software-swapped)
 *   - KWS-AC301L via built-in RS485 (Serial2, GPIO 14 RX / 13 TX, auto-direction)
 *   - Ethernet (LAN8720 PHY) primary + WiFi fallback (auto-failover)
 *   - MQTT publisher (board-level payload, sensors object)
 *   - ArduinoOTA       → update firmware over the air (no USB after first flash)
 *   - WebServer        → http://<board-ip>/ shows live status + restart button
 *   - FreeRTOS task split: sensorTask (core 0) + mqttTask (core 1)
 *   - Hardware watchdog: auto-restart if any task stalls
 *
 * Topic:   sites/<SITE_CODE>/boards/<BOARD_CODE>/telemetry
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <ETH.h>
#include <ESPmDNS.h>
#include <ArduinoOTA.h>
#include <Update.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <PubSubClient.h>
#include <PZEM004Tv30.h>
#include <ModbusMaster.h>
#include <ArduinoJson.h>
#include <esp_task_wdt.h>
#include <time.h>
#include <sys/time.h>
#include "secrets.h"
#include "config.h"
#include "queue.h"

struct KwsReading {
  bool ok;
  // Aggregates (per the existing single-phase contract). For AC306L:
  // voltage = V_A (Phase A as the reference); current = I_A + I_B + I_C;
  // power = meter-internal Total (register 0x0017), energy = meter
  // Total (0x0034). For AC301L, the per-phase fields are zero and
  // voltage/current/power carry the single-phase reading directly.
  float voltage, current, power, energy, frequency, pf, temperature;
  // Per-phase breakdown (KWS-306L only; AC301L leaves these at zero).
  float vA, vB, vC;
  float iA, iB, iC;
  float pA, pB, pC;
};

// Firmware version is the only truly static "config" — everything else lives
// in NVS so it can be edited from the AP-mode setup portal.
const char* FIRMWARE_VERSION  = "v0.13.15";

const uint32_t PUBLISH_INTERVAL_MS = 3000;
const uint32_t WDT_TIMEOUT_S       = 30;

// ─── HKL-EA8 pin map ────────────────────────────────────────────────
// PZEM/KWS UART pins (chosen so they do not collide with the RMII bus the
// Ethernet PHY uses: GPIO 0/17 clock, 19/21/22/25/26/27 data, 18 MDIO, 23 MDC).
#define PZEM_RX_PIN 16
#define PZEM_TX_PIN 15
#define KWS_RX_PIN  14
#define KWS_TX_PIN  13

// LAN8720 PHY wiring on HKL-EA8.
#define ETH_PHY_TYPE_HKL  ETH_PHY_LAN8720
#define ETH_PHY_ADDR_HKL  0
#define ETH_PHY_POWER_HKL -1
#define ETH_PHY_MDC_HKL   23
#define ETH_PHY_MDIO_HKL  18
#define ETH_CLK_MODE_HKL  ETH_CLOCK_GPIO17_OUT

// On-board buzzer (HKL-EA8 datasheet). GPIO 12 is a strapping pin so the
// driver on the board is designed to leave it low during reset — we only
// drive it after boot from setup().
#define BUZZER_PIN 12
#define BEEP_FREQ_HZ 2000
#define BEEP_MS      80
#define BEEP_GAP_MS  90

// ─── Globals ────────────────────────────────────────────────────────
PZEM004Tv30 pzem(Serial1, PZEM_RX_PIN, PZEM_TX_PIN);
ModbusMaster kws;
// Two transport-layer clients ready to go; setup() chooses which one
// PubSubClient hands off to based on cfg.mqttTls.
WiFiClient        wifiClient;
WiFiClientSecure  wifiClientSecure;
PubSubClient mqtt(wifiClient);
WebServer webServer(80);

char mqttTopic[160];
char mqttCmdTopic[160];
char mqttOtaStatusTopic[160];
char clientId[64];

// Network transport state. ETH is preferred; WiFi is the fallback.
volatile bool g_ethConnected = false;
volatile bool g_ethHasIp     = false;
volatile bool g_webServerStarted = false;

// Firmware-OTA types declared here so Arduino's auto-generated function
// prototypes (inserted at the top of the .ino during preprocessing) see
// `FwState` before any function signature uses it. The struct/globals
// themselves live in the OTA section further down.
enum FwState { FW_IDLE, FW_DOWNLOADING, FW_APPLYING, FW_SUCCESS, FW_FAILED };
struct FirmwareProgress {
  FwState state;
  size_t  done, total;
  char    message[80];
  char    newVersion[24];
};

// OTA shared state — must be visible to onMqttCommand() (which sits near the
// top of the file) AND to the OTA section further down. Defined once here so
// the Arduino preprocessor sees them before either user-of-them.
static FirmwareProgress g_fwProg = { FW_IDLE, 0, 0, "", "" };
static volatile bool g_fwCloudPending = false;
static char g_fwCloudUrl[256] = "";

// Forward-declare any function that's used (line ~540) before it's defined
// further down — the Arduino preprocessor sometimes drops these when the
// .ino has large embedded raw-string literals between use and definition.
void startWebServer();
// Defined in portal.ino. Arduino's preprocessor only auto-prototypes
// functions in the MAIN sketch, so this cross-file reference needs an
// explicit declaration here.
String mdnsHostname();

const char* activeTransport() {
  if (g_ethHasIp) return "ethernet";
  if (WiFi.status() == WL_CONNECTED) return "wifi";
  return "offline";
}

IPAddress activeLocalIp() {
  if (g_ethHasIp) return ETH.localIP();
  if (WiFi.status() == WL_CONNECTED) return WiFi.localIP();
  return IPAddress();
}

bool isOnline() {
  return g_ethHasIp || WiFi.status() == WL_CONNECTED;
}

// Parse "10.88.1.178" into an IPAddress, or 0.0.0.0 if unparseable. Used for
// the optional static-IP config — empty/garbage strings are treated as "not
// set" so the firmware silently falls back to DHCP for that field.
static IPAddress parseIpOrZero(const char* s) {
  IPAddress ip;
  if (!s || !*s || !ip.fromString(s)) return IPAddress((uint32_t)0);
  return ip;
}

static bool isStaticIpMode() {
  return strcmp(cfg.ipMode, "static") == 0 && cfg.staticIp[0] != '\0';
}

static bool ntpSynced() {
  return time(nullptr) > 1700000000;
}

// HTTP fallback when NTP (UDP 123) is unavailable — many corporate / NAT'd
// networks block outbound 123 to public pools, and not every self-hosted
// server runs an NTP daemon. The frontend container always serves the
// monitor app over HTTP on the same host as the MQTT broker, so we hit
// /api/time there and parse the Unix-ms timestamp out of the JSON.
//
// Tries port 8081 (default deploy) then 80 (host nginx). Returns true on
// success and sets the system clock.
bool fetchTimeOverHttp() {
  if (!isOnline()) return false;
  const uint16_t ports[] = { 8081, 80 };
  for (uint16_t port : ports) {
    HTTPClient http;
    String url = String("http://") + cfg.mqttHost + ":" + port + "/api/time";
    http.setTimeout(3000);
    http.setConnectTimeout(3000);
    if (!http.begin(url)) continue;
    int code = http.GET();
    String body = (code == 200) ? http.getString() : String();
    http.end();
    if (code != 200) continue;
    int idx = body.indexOf("\"timeMs\"");
    if (idx < 0) continue;
    int colon = body.indexOf(':', idx);
    if (colon < 0) continue;
    long long ms = atoll(body.c_str() + colon + 1);
    if (ms < 1700000000000LL) continue;
    struct timeval tv;
    tv.tv_sec  = static_cast<time_t>(ms / 1000);
    tv.tv_usec = static_cast<suseconds_t>((ms % 1000) * 1000);
    settimeofday(&tv, nullptr);
    Serial.printf("Time: HTTP fallback synced from %s\n", url.c_str());
    return true;
  }
  return false;
}

// Combined CPU usage across both cores, 0–100 %. Works by sampling FreeRTOS
// idle-task runtime counters between calls; relies on the run-time-stats
// build flag that the ESP32 Arduino core enables by default.
float getCpuUsagePercent() {
  static uint32_t prevTotal = 0;
  static uint64_t prevIdle  = 0;
  const UBaseType_t MAX_TASKS = 32;
  TaskStatus_t tasks[MAX_TASKS];
  uint32_t totalRuntime;
  UBaseType_t count = uxTaskGetSystemState(tasks, MAX_TASKS, &totalRuntime);

  uint64_t idleSum = 0;
  for (UBaseType_t i = 0; i < count; i++) {
    if (strncmp(tasks[i].pcTaskName, "IDLE", 4) == 0) {
      idleSum += tasks[i].ulRunTimeCounter;
    }
  }
  uint32_t dTotal = totalRuntime - prevTotal;
  uint64_t dIdle  = idleSum    - prevIdle;
  prevTotal = totalRuntime;
  prevIdle  = idleSum;
  if (dTotal == 0) return 0;
  // Dual-core: maximum possible idle is 2 × elapsed (both cores idling).
  float idleRatio = (float)dIdle / (2.0f * (float)dTotal);
  if (idleRatio > 1.0f) idleRatio = 1.0f;
  return 100.0f * (1.0f - idleRatio);
}

// ─── Buzzer ─────────────────────────────────────────────────────────
// Audible boot feedback so the operator knows the board is alive without
// needing to plug in a serial cable. Uses LEDC (8-bit PWM) so the same code
// drives both active and passive buzzers — an active buzzer just hears the
// duty cycle as a steady "on", a passive buzzer hears the 2kHz tone.
static bool g_buzzerReady = false;

void buzzerBegin() {
  if (!ledcAttach(BUZZER_PIN, BEEP_FREQ_HZ, 8)) {
    Serial.println("Buzzer: ledcAttach failed");
    return;
  }
  ledcWrite(BUZZER_PIN, 0);
  g_buzzerReady = true;
}

void beep(uint16_t ms) {
  if (!g_buzzerReady) return;
  ledcWriteTone(BUZZER_PIN, BEEP_FREQ_HZ);
  delay(ms);
  ledcWriteTone(BUZZER_PIN, 0);
}

void beepN(uint8_t n) {
  for (uint8_t i = 0; i < n; ++i) {
    if (i) delay(BEEP_GAP_MS);
    beep(BEEP_MS);
  }
}

// Shared state between sensorTask and mqttTask (protected by mutex).
struct SharedReading {
  bool pzemOk;
  float pV, pI, pP, pE, pFreq, pPF;
  KwsReading kws;
  uint32_t updatedAt;
  uint32_t totalPublishes;
  uint32_t mqttFailures;
};
SharedReading shared{};
SemaphoreHandle_t sharedMtx;

// ─── Helpers ────────────────────────────────────────────────────────

// AC301L single-phase reader (the original implementation). Register
// map: V at 0x000E ÷10, I+P at 0x000F-0x0012 (LOW word first), E at
// 0x0017 ÷1000, temp/pf/freq at 0x001A/0x001D/0x001E.
static KwsReading readKwsAc301L() {
  KwsReading r{};
  uint8_t result = kws.readHoldingRegisters(0x000E, 5);
  if (result != kws.ku8MBSuccess) {
    r.ok = false;
    return r;
  }
  r.voltage     = kws.getResponseBuffer(0) / 10.0f;
  uint32_t iRaw = ((uint32_t)kws.getResponseBuffer(2) << 16) | kws.getResponseBuffer(1);
  r.current     = iRaw / 1000.0f;
  uint32_t pRaw = ((uint32_t)kws.getResponseBuffer(4) << 16) | kws.getResponseBuffer(3);
  r.power       = pRaw / 10.0f;

  result = kws.readHoldingRegisters(0x0017, 8);
  if (result != kws.ku8MBSuccess) {
    r.ok = true;
    return r;
  }
  r.energy      = kws.getResponseBuffer(0) / 1000.0f;
  int16_t tRaw  = (int16_t)kws.getResponseBuffer(3);
  r.temperature = tRaw;
  r.pf          = kws.getResponseBuffer(6) / 100.0f;
  r.frequency   = kws.getResponseBuffer(7) / 10.0f;
  // Mirror single-phase reading into the Phase-A slot so downstream
  // consumers can ignore the AC301L vs AC306L distinction.
  r.vA = r.voltage;
  r.iA = r.current;
  r.pA = r.power;
  r.ok = true;
  return r;
}

// AC306L 3-phase reader. Differences from AC301L worth flagging:
//   - Voltage scale is ÷100 (vs ÷10 on AC301L)
//   - 32-bit values are HIGH word first (vs LOW first on AC301L)
//   - V/I/P broken out per phase, plus total power/energy at dedicated
//     registers (0x0017 power, 0x0034 energy)
//   - Energy scale is ÷100 (vs ÷1000 on AC301L)
//   - Temperature lives at 0x003C, not 0x001A
// We collapse the 3-phase reading into the single-phase KwsReading
// struct: V uses Phase A (typical wiring + matches what the AC301L
// would have reported at the same physical install), I = sum of
// phases, P/E = meter-internal totals. Per-phase values are available
// for later expansion into the MQTT raw payload but aren't published
// yet — the backend ingestion path doesn't know about them.
static KwsReading readKwsAc306L() {
  KwsReading r{};
  // Use the SAME request pattern as the AC301L reader (5 words at
  // 0x000E + 8 words at 0x0017) — proven to elicit a response from
  // this meter under live wiring. Just reinterpret the bytes per the
  // AC306L semantic:
  //
  //   Read 1 — 5 words at 0x000E:
  //     [0] V_A (÷100)   [1] V_B   [2] V_C
  //     [3] I_A_hi       [4] I_A_lo   →  I_A = (hi<<16|lo) ÷ 1000
  //
  //   Read 2 — 8 words at 0x0017:
  //     [0..1] P_total (÷10, HIGH first)
  //     [2..3] P_A      [4..5] P_B      [6..7] P_C
  //
  // Per-phase B/C currents (0x0013..0x0016), total energy (0x0034),
  // PF / freq (0x002F-0x0033) and temperature (0x003C) sit outside
  // these two blocks. Earlier attempts to add extra Modbus reads broke
  // the meter (it stopped responding to ANY frame for a while). Keep
  // the request count identical to AC301L — that's the safe envelope.
  uint8_t result = kws.readHoldingRegisters(0x000E, 5);
  if (result != kws.ku8MBSuccess) { r.ok = false; return r; }
  r.vA = kws.getResponseBuffer(0) / 100.0f;
  r.vB = kws.getResponseBuffer(1) / 100.0f;
  r.vC = kws.getResponseBuffer(2) / 100.0f;
  uint32_t iA_raw = ((uint32_t)kws.getResponseBuffer(3) << 16) | kws.getResponseBuffer(4);
  r.iA = iA_raw / 1000.0f;

  // I_B + I_C at 0x0013..0x0016 — 4 words (2 × U32 HIGH first).
  delay(20);
  result = kws.readHoldingRegisters(0x0013, 4);
  if (result == kws.ku8MBSuccess) {
    uint32_t iB_raw = ((uint32_t)kws.getResponseBuffer(0) << 16) | kws.getResponseBuffer(1);
    uint32_t iC_raw = ((uint32_t)kws.getResponseBuffer(2) << 16) | kws.getResponseBuffer(3);
    r.iB = iB_raw / 1000.0f;
    r.iC = iC_raw / 1000.0f;
  }

  delay(20);
  result = kws.readHoldingRegisters(0x0017, 8);
  if (result != kws.ku8MBSuccess) {
    // Got V/I from the first block — surface what we have rather than
    // dropping the whole read on the floor.
    r.voltage = r.vA;
    r.current = r.iA + r.iB + r.iC;
    r.ok = true;
    return r;
  }
  uint32_t pTot_raw = ((uint32_t)kws.getResponseBuffer(0) << 16) | kws.getResponseBuffer(1);
  uint32_t pA_raw   = ((uint32_t)kws.getResponseBuffer(2) << 16) | kws.getResponseBuffer(3);
  uint32_t pB_raw   = ((uint32_t)kws.getResponseBuffer(4) << 16) | kws.getResponseBuffer(5);
  uint32_t pC_raw   = ((uint32_t)kws.getResponseBuffer(6) << 16) | kws.getResponseBuffer(7);
  r.pA = pA_raw / 10.0f;
  r.pB = pB_raw / 10.0f;
  r.pC = pC_raw / 10.0f;

  r.voltage = r.vA;                          // Phase A as the reference
  r.current = r.iA + r.iB + r.iC;            // sum of phases
  r.power   = pTot_raw / 10.0f;              // meter-internal Total
  r.ok = true;

  // ── Optional tail reads (PF / freq, energy, temperature) ──
  // These three sit outside the proven 0x000E + 0x0017 blocks. Earlier
  // attempts piled six reads back-to-back and the meter stopped
  // responding to ANY frame for tens of seconds. So we keep the
  // request count small (3 extra), space them out with brief delays,
  // and treat failures as "skip this field, keep going" — never reset
  // r.ok to false based on these. The basic V/I/P numbers above are
  // the load-bearing part of the reading.
  delay(20);
  result = kws.readHoldingRegisters(0x002F, 5);   // PF_total..Freq
  if (result == kws.ku8MBSuccess) {
    r.pf        = kws.getResponseBuffer(0) / 1000.0f;
    r.frequency = kws.getResponseBuffer(4) / 100.0f;
  }

  delay(20);
  result = kws.readHoldingRegisters(0x0034, 2);   // Total energy
  if (result == kws.ku8MBSuccess) {
    uint32_t e_raw = ((uint32_t)kws.getResponseBuffer(0) << 16) | kws.getResponseBuffer(1);
    r.energy = e_raw / 100.0f;
  }

  delay(20);
  result = kws.readHoldingRegisters(0x003C, 1);   // Temperature
  if (result == kws.ku8MBSuccess) {
    r.temperature = (int16_t)kws.getResponseBuffer(0);
  }

  return r;
}

KwsReading readKws() {
  // Branch on the explicit phase setting from config. Default to
  // 1-phase if NVS held an older blob without the field (cfg.kwsPhases
  // zero-inits to 0, which we treat as 1-phase too).
  return (cfg.kwsPhases == 3) ? readKwsAc306L() : readKwsAc301L();
}

void connectWiFi() {
  // Don't bother turning WiFi on if we already have a working Ethernet link —
  // it just wastes radio and battery and complicates the routing table.
  if (g_ethHasIp) return;
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.printf("WiFi: connecting to %s\n", cfg.wifiSsid);
  WiFi.mode(WIFI_STA);
  WiFi.setHostname(cfg.boardCode);
  if (isStaticIpMode()) {
    IPAddress ip = parseIpOrZero(cfg.staticIp);
    IPAddress gw = parseIpOrZero(cfg.staticGateway);
    IPAddress sn = parseIpOrZero(cfg.staticSubnet);
    IPAddress dns = parseIpOrZero(cfg.staticDns);
    if (ip != IPAddress((uint32_t)0)) {
      WiFi.config(ip, gw, sn, dns);
      Serial.printf("WiFi: static IP=%s gw=%s\n",
                    ip.toString().c_str(), gw.toString().c_str());
    }
  }
  WiFi.begin(cfg.wifiSsid, cfg.wifiPassword);
  uint32_t start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 30000) {
    if (g_ethHasIp) {                       // ETH came up while we were waiting
      Serial.println("\nWiFi: aborting — ETH is up");
      return;
    }
    delay(500);
    Serial.print(".");
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\nWiFi: connected IP=%s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\nWiFi: failed - will retry");
  }
}

// ESP32 fires the same Arduino event id for both WiFi and ETH events.
void onNetworkEvent(arduino_event_id_t event, arduino_event_info_t /*info*/) {
  switch (event) {
    case ARDUINO_EVENT_ETH_START:
      Serial.println("ETH: start");
      ETH.setHostname(cfg.boardCode);
      break;
    case ARDUINO_EVENT_ETH_CONNECTED:
      Serial.println("ETH: cable connected");
      g_ethConnected = true;
      break;
    case ARDUINO_EVENT_ETH_GOT_IP:
      Serial.printf("ETH: got IP=%s  link=%dMbps %s\n",
                    ETH.localIP().toString().c_str(),
                    ETH.linkSpeed(),
                    ETH.fullDuplex() ? "full-duplex" : "half-duplex");
      g_ethHasIp = true;
      // ETH is the preferred transport — drop WiFi to free the radio.
      if (WiFi.status() == WL_CONNECTED) {
        Serial.println("ETH: preferred — disconnecting WiFi");
        WiFi.disconnect(true, false);
      }
      break;
    case ARDUINO_EVENT_ETH_LOST_IP:
    case ARDUINO_EVENT_ETH_DISCONNECTED:
      Serial.println("ETH: link/IP lost — falling back to WiFi");
      g_ethConnected = false;
      g_ethHasIp = false;
      break;
    case ARDUINO_EVENT_ETH_STOP:
      g_ethConnected = false;
      g_ethHasIp = false;
      break;
    default:
      break;
  }
}

// Inbound command from the backend. Topic: sites/<site>/boards/<board>/cmd.
// Payload is JSON with at least an `action` field. The OTA path mirrors what
// the local /api/firmware/apply-cloud handler does: stage the URL + version
// and let the main-loop tick pick it up so the long-running download runs
// outside of any callback context.
void onMqttCommand(char* topic, byte* payload, unsigned int len) {
  StaticJsonDocument<512> doc;
  DeserializationError err = deserializeJson(doc, payload, len);
  if (err) {
    Serial.printf("MQTT cmd: bad JSON (%s)\n", err.c_str());
    return;
  }
  const char* action = doc["action"] | "";
  if (strcmp(action, "ota_install") == 0) {
    const char* version = doc["version"] | "";
    const char* url     = doc["downloadUrl"] | "";
    if (url[0] == 0) {
      Serial.println("MQTT cmd: ota_install missing downloadUrl");
      return;
    }
    strncpy(g_fwCloudUrl, url, sizeof(g_fwCloudUrl) - 1);
    g_fwCloudUrl[sizeof(g_fwCloudUrl) - 1] = 0;
    strncpy(g_fwProg.newVersion, version, sizeof(g_fwProg.newVersion) - 1);
    g_fwProg.newVersion[sizeof(g_fwProg.newVersion) - 1] = 0;
    g_fwCloudPending = true;
    Serial.printf("MQTT cmd: ota_install %s from %s — staged\n", version, url);
  } else {
    Serial.printf("MQTT cmd: unknown action '%s'\n", action);
  }
}

// Non-blocking single attempt to (re)connect to the MQTT broker. Returns true
// if we are connected at the end of the call. Designed to be called once per
// task tick — never spins, never blocks longer than PubSubClient's TCP
// connect timeout (~5 s built-in). Keeping it non-blocking is what lets the
// web UI stay reachable even when the broker is down.
bool tryConnectMqtt() {
  if (mqtt.connected()) return true;
  bool ok = (strlen(cfg.mqttUser) > 0)
    ? mqtt.connect(clientId, cfg.mqttUser, cfg.mqttPassword)
    : mqtt.connect(clientId);
  if (ok) {
    Serial.println("MQTT: connected");
    // (Re)subscribe to our cmd topic on every successful reconnect — broker
    // may have dropped the subscription with the previous session.
    if (mqtt.subscribe(mqttCmdTopic, 1)) {
      Serial.printf("MQTT: subscribed to %s\n", mqttCmdTopic);
    } else {
      Serial.printf("MQTT: subscribe(%s) FAILED\n", mqttCmdTopic);
    }
  } else {
    Serial.printf("MQTT: failed rc=%d — web UI still up, will retry\n", mqtt.state());
  }
  return ok;
}

// Snapshot the latest sensor readings into a binary record. Captures the
// current NTP time at call site — caller doesn't need to set it.
void buildRecord(TelemetryRecord& r) {
  memset(&r, 0, sizeof(r));
  struct timeval tv;
  gettimeofday(&tv, nullptr);
  r.timeMs = (uint64_t)tv.tv_sec * 1000ULL + (uint64_t)(tv.tv_usec / 1000ULL);
  if (xSemaphoreTake(sharedMtx, pdMS_TO_TICKS(200)) == pdTRUE) {
    r.flags = (shared.pzemOk ? 0x01 : 0) | (shared.kws.ok ? 0x02 : 0);
    r.pzemV = shared.pV; r.pzemI = shared.pI; r.pzemP = shared.pP;
    r.pzemE = shared.pE; r.pzemPF = shared.pPF; r.pzemFreq = shared.pFreq;
    r.kwsV = shared.kws.voltage; r.kwsI = shared.kws.current;
    r.kwsP = shared.kws.power;   r.kwsE = shared.kws.energy;
    r.kwsPF = shared.kws.pf;     r.kwsFreq = shared.kws.frequency;
    r.kwsTemp = shared.kws.temperature;
    r.kwsVa = shared.kws.vA; r.kwsVb = shared.kws.vB; r.kwsVc = shared.kws.vC;
    r.kwsIa = shared.kws.iA; r.kwsIb = shared.kws.iB; r.kwsIc = shared.kws.iC;
    r.kwsPa = shared.kws.pA; r.kwsPb = shared.kws.pB; r.kwsPc = shared.kws.pC;
    xSemaphoreGive(sharedMtx);
  }
}

// Serialize a record to JSON and publish it to MQTT. The board-side
// timestamp is included as ISO-8601 UTC so the backend can stamp telemetry
// rows accurately even when records are replayed minutes/hours later.
bool publishRecord(const TelemetryRecord& r) {
  // Bumped from 512 → 1024 to fit the 9 per-phase fields in the KWS
  // sensor's `raw` object.
  StaticJsonDocument<1024> doc;
  doc["boardCode"] = cfg.boardCode;
  doc["firmware"]  = FIRMWARE_VERSION;
  doc["ipAddress"] = activeLocalIp().toString();
  doc["transport"] = activeTransport();

  // Render the timestamp only if we actually have a synced clock. A record
  // captured before NTP sync has timeMs == 0 — let the backend stamp it on
  // receive (consistent with the v0.10.x behaviour).
  if (r.timeMs > 1700000000000ULL) {
    char tbuf[32];
    time_t secs = r.timeMs / 1000ULL;
    uint32_t ms = (uint32_t)(r.timeMs % 1000ULL);
    struct tm tm_utc;
    gmtime_r(&secs, &tm_utc);
    size_t n = strftime(tbuf, sizeof(tbuf), "%Y-%m-%dT%H:%M:%S", &tm_utc);
    snprintf(tbuf + n, sizeof(tbuf) - n, ".%03uZ", (unsigned)ms);
    doc["time"] = tbuf;
  }

  JsonObject sensors = doc.createNestedObject("sensors");

  JsonObject pS = sensors.createNestedObject(cfg.sensorPzemCode);
  if (r.flags & 0x01) {
    pS["voltage"] = r.pzemV;
    pS["current"] = r.pzemI;
    pS["power"]   = r.pzemP;
    pS["energy"]  = r.pzemE;
    JsonObject raw = pS.createNestedObject("raw");
    raw["pf"] = r.pzemPF;
    raw["frequency"] = r.pzemFreq;
  } else {
    pS["error"] = "no_signal";
  }

  JsonObject kS = sensors.createNestedObject(cfg.sensorKwsCode);
  if (r.flags & 0x02) {
    kS["voltage"]     = r.kwsV;
    kS["current"]     = r.kwsI;
    kS["power"]       = r.kwsP;
    kS["energy"]      = r.kwsE;
    kS["temperature"] = r.kwsTemp;
    JsonObject raw = kS.createNestedObject("raw");
    raw["pf"] = r.kwsPF;
    raw["frequency"] = r.kwsFreq;
    // Per-phase breakdown (zeros for AC301L). Backend ingestion can
    // pick these up via `raw.*` when it grows per-phase support.
    raw["vA"] = r.kwsVa; raw["vB"] = r.kwsVb; raw["vC"] = r.kwsVc;
    raw["iA"] = r.kwsIa; raw["iB"] = r.kwsIb; raw["iC"] = r.kwsIc;
    raw["pA"] = r.kwsPa; raw["pB"] = r.kwsPb; raw["pC"] = r.kwsPc;
  } else {
    kS["error"] = "no_signal";
  }

  char buf[1024];
  size_t n = serializeJson(doc, buf, sizeof(buf));
  bool ok = mqtt.publish(mqttTopic, (const uint8_t*)buf, n, false);
  if (xSemaphoreTake(sharedMtx, pdMS_TO_TICKS(100)) == pdTRUE) {
    if (ok) shared.totalPublishes += 1;
    else shared.mqttFailures += 1;
    xSemaphoreGive(sharedMtx);
  }
  return ok;
}

// ─── FreeRTOS tasks ────────────────────────────────────────────────
void sensorTask(void* /*arg*/) {
  esp_task_wdt_add(NULL);
  static uint8_t pzemFails = 0;
  static uint8_t kwsFails  = 0;
  const uint8_t  RECOVER_AFTER = 5;   // ~15 s of consecutive read failures
  for (;;) {
    // Drain any stale bytes from the RX FIFO. When the sensor cable was
    // unplugged the line floats and we collect noise; without this drain the
    // next valid frame gets concatenated with garbage and the parser fails.
    while (Serial1.available()) Serial1.read();
    float pV = pzem.voltage();
    bool pzemOk = !isnan(pV);
    SharedReading next{};
    next.pzemOk = pzemOk;
    if (pzemOk) {
      next.pV    = pV;
      next.pI    = pzem.current();
      next.pP    = pzem.power();
      next.pE    = pzem.energy();
      next.pFreq = pzem.frequency();
      next.pPF   = pzem.pf();
      pzemFails  = 0;
    } else if (++pzemFails >= RECOVER_AFTER) {
      Serial.println("PZEM: hard reset of UART after repeated failures");
      Serial1.end();
      delay(50);
      Serial1.begin(9600, SERIAL_8N1, PZEM_RX_PIN, PZEM_TX_PIN);
      pzemFails = 0;
    }

    while (Serial2.available()) Serial2.read();
    next.kws = readKws();
    if (next.kws.ok) {
      kwsFails = 0;
    } else if (++kwsFails >= RECOVER_AFTER) {
      Serial.println("KWS: hard reset of UART + Modbus after repeated failures");
      Serial2.end();
      delay(50);
      Serial2.begin(9600, SERIAL_8N1, KWS_RX_PIN, KWS_TX_PIN);
      kws.begin(cfg.kwsSlaveAddr, Serial2);
      kwsFails = 0;
    }
    next.updatedAt = millis();

    if (xSemaphoreTake(sharedMtx, pdMS_TO_TICKS(500)) == pdTRUE) {
      next.totalPublishes = shared.totalPublishes;
      next.mqttFailures   = shared.mqttFailures;
      shared = next;
      xSemaphoreGive(sharedMtx);
    }

    Serial.println();
    if (pzemOk) {
      Serial.printf("  %s:  V=%6.1f I=%6.3f W=%6.1f E=%7.3f kWh PF=%.2f %.1fHz\n",
                    cfg.sensorPzemCode, next.pV, next.pI, next.pP, next.pE, next.pPF, next.pFreq);
    } else {
      Serial.printf("  %s: no signal\n", cfg.sensorPzemCode);
    }
    if (next.kws.ok) {
      Serial.printf("  %s:   V=%6.1f I=%6.3f W=%6.1f E=%7.3f kWh PF=%.2f %.1fHz T=%.1fC\n",
                    cfg.sensorKwsCode, next.kws.voltage, next.kws.current, next.kws.power,
                    next.kws.energy, next.kws.pf, next.kws.frequency, next.kws.temperature);
    } else {
      Serial.printf("  %s:  no signal\n", cfg.sensorKwsCode);
    }

    // Capture a binary record and enqueue it. mqttTask drains the queue at
    // up to 10 msg/s when the broker is reachable. We don't try to publish
    // here directly — keeping all publishes on mqttTask preserves the
    // FreeRTOS task split (PubSubClient is not thread-safe).
    TelemetryRecord rec;
    buildRecord(rec);
    if (!tqAppend(rec)) {
      Serial.println("Queue: append failed (flash full?)");
    }

    esp_task_wdt_reset();
    vTaskDelay(pdMS_TO_TICKS(PUBLISH_INTERVAL_MS));
  }
}

void mqttTask(void* /*arg*/) {
  esp_task_wdt_add(NULL);
  static bool     readyBeepDone     = false;
  static uint32_t lastMqttAttempt   = 0;
  static uint32_t lastDrain         = 0;
  static uint32_t lastBacklogReport = 0;
  const  uint32_t MQTT_RETRY_MS     = 5000;
  const  uint32_t DRAIN_INTERVAL_MS = 100;   // 10 msg/sec replay cap
  for (;;) {
    if (!isOnline()) {
      // No transport at all — try WiFi (ETH comes up via its own event handler).
      connectWiFi();
    } else {
      // The web server can only be started once we know our IP. We delay it
      // until we're actually online so it binds to the right interface.
      if (!g_webServerStarted) {
        startWebServer();
      }
      // Non-blocking reconnect. If the broker is unreachable, we just fall
      // through — webServer.handleClient() below still runs so the operator
      // can open the dashboard / Settings page and fix the broker config.
      if (!mqtt.connected() && millis() - lastMqttAttempt >= MQTT_RETRY_MS) {
        lastMqttAttempt = millis();
        Serial.printf("MQTT: connecting to %s:%u as %s (via %s) — backlog=%u\n",
                      cfg.mqttHost, cfg.mqttPort, clientId, activeTransport(),
                      (unsigned)tqPending());
        tryConnectMqtt();
      }
      // Two short beeps once everything is up: network + web UI + MQTT.
      if (!readyBeepDone && mqtt.connected() && g_webServerStarted) {
        readyBeepDone = true;
        beepN(2);
        Serial.println("Boot: ready (MQTT + Web UI online)");
      }

      // Background time-sync retry — fires every 60 s while the clock is
      // still un-synced. Tries the HTTP /api/time fallback first since that's
      // what works in NTP-less deployments; lwIP's SNTP daemon keeps
      // retrying the NTP servers on its own schedule.
      static uint32_t lastTimeRetry = 0;
      if (!ntpSynced() && millis() - lastTimeRetry >= 60000) {
        lastTimeRetry = millis();
        fetchTimeOverHttp();
      }
      if (mqtt.connected()) {
        mqtt.loop();
        // Rate-limited replay: at most one record per DRAIN_INTERVAL_MS.
        // sensorTask writes ~one record every 3 s, so the drain naturally
        // outruns the producer and the queue empties out 30× faster than it
        // fills during normal operation. After an outage the same 10 msg/s
        // pulls a 1 h backlog in 6 minutes.
        if (millis() - lastDrain >= DRAIN_INTERVAL_MS) {
          lastDrain = millis();
          TelemetryRecord rec;
          if (tqDrainOne(rec)) {
            if (!publishRecord(rec)) {
              // Publish failed — we already advanced the read offset, but
              // PubSubClient sets mqtt.connected()=false on failure so the
              // next loop iteration will re-attempt connect. The lost record
              // is the trade for not blocking the task on retries.
              Serial.println("MQTT: publish failed mid-drain");
            }
          }
        }
        // Periodic backlog summary so operators can see catch-up progress.
        if (tqPending() > 0 && millis() - lastBacklogReport >= 10000) {
          lastBacklogReport = millis();
          Serial.printf("Queue: %u pending (%u B on flash)\n",
                        (unsigned)tqPending(), (unsigned)tqFileBytes());
        }
      }
    }
    // Runtime BOOT-button watch: held LOW continuously for ≥3 s while the
    // device is running → reboot into the AP-mode portal. The setup() boot
    // check also covers the "hold during power-up" case.
    {
      static uint32_t bootPressStart = 0;
      if (digitalRead(0) == LOW) {
        if (bootPressStart == 0) bootPressStart = millis();
        else if (millis() - bootPressStart >= 3000) {
          Serial.println("BOOT: held 3s at runtime — entering portal");
          beepN(3);
          cfg.wantsPortalOnNextBoot = true;
          saveConfig();
          delay(200);
          ESP.restart();
        }
      } else {
        bootPressStart = 0;
      }
    }

    ArduinoOTA.handle();
    webServer.handleClient();
    // Cloud OTA download runs HERE (not inside the HTTP handler) so the
    // operator's browser doesn't time out during a multi-minute flash.
    handleCloudUpdateTick();
    esp_task_wdt_reset();
    vTaskDelay(pdMS_TO_TICKS(50));
  }
}

// ─── Web server ─────────────────────────────────────────────────────
String buildStatusJson() {
  // Bumped from 896 → 1536 for the 9 per-phase KWS fields.
  StaticJsonDocument<1536> doc;
  doc["boardCode"] = cfg.boardCode;
  doc["siteCode"]  = cfg.siteCode;
  doc["firmware"]  = FIRMWARE_VERSION;
  doc["transport"] = activeTransport();
  doc["ipAddress"] = activeLocalIp().toString();
  doc["wifiConnected"] = WiFi.status() == WL_CONNECTED;
  doc["wifiIp"]        = WiFi.status() == WL_CONNECTED ? WiFi.localIP().toString() : String("");
  doc["wifiSsid"]      = cfg.wifiSsid;
  doc["rssi"]      = WiFi.RSSI();
  doc["ethConnected"]  = (bool)g_ethConnected;
  doc["ethGotIp"]      = (bool)g_ethHasIp;
  doc["ethIp"]         = g_ethHasIp ? ETH.localIP().toString() : String("");
  doc["ethLinkMbps"]   = g_ethConnected ? ETH.linkSpeed() : 0;
  doc["ethFullDuplex"] = g_ethConnected ? ETH.fullDuplex() : false;
  doc["uptimeMs"]  = millis();
  doc["mqttConnected"] = mqtt.connected();
  doc["mqttHost"]  = String(cfg.mqttHost) + ":" + String(cfg.mqttPort);
  doc["mqttTopic"] = mqttTopic;
  doc["mqttTls"]   = cfg.mqttTls;

  // Host system telemetry (sampled per request — getCpuUsagePercent() keeps
  // its own running delta so polling cadence doesn't matter).
  doc["cpuFreqMhz"]  = ESP.getCpuFreqMHz();
  doc["cpuUsagePct"] = getCpuUsagePercent();
  doc["heapTotal"]   = ESP.getHeapSize();
  doc["heapFree"]    = ESP.getFreeHeap();
  doc["heapMinFree"] = ESP.getMinFreeHeap();
  doc["sketchSize"]  = ESP.getSketchSize();
  doc["sketchFree"]  = ESP.getFreeSketchSpace();
  doc["queuePending"] = tqPending();
  doc["queueBytes"]   = (uint32_t)tqFileBytes();
  doc["ntpSynced"]    = time(nullptr) > 1700000000;

  if (xSemaphoreTake(sharedMtx, pdMS_TO_TICKS(200)) == pdTRUE) {
    doc["lastReadingAgoMs"] = millis() - shared.updatedAt;
    doc["totalPublishes"]   = shared.totalPublishes;
    doc["mqttFailures"]     = shared.mqttFailures;
    JsonObject pzemJ = doc.createNestedObject("pzem");
    pzemJ["code"]    = cfg.sensorPzemCode;
    pzemJ["ok"]      = shared.pzemOk;
    pzemJ["voltage"] = shared.pV;
    pzemJ["current"] = shared.pI;
    pzemJ["power"]   = shared.pP;
    pzemJ["energy"]  = shared.pE;
    pzemJ["pf"]      = shared.pPF;
    pzemJ["freq"]    = shared.pFreq;
    JsonObject kw = doc.createNestedObject("kws");
    kw["code"]        = cfg.sensorKwsCode;
    // Diagnostic — phases (1 or 3) + slave addr so a /api/status read
    // is enough to tell which Modbus path the board is exercising.
    kw["phases"]      = (cfg.kwsPhases == 3) ? 3 : 1;
    kw["slaveAddr"]   = cfg.kwsSlaveAddr;
    kw["ok"]          = shared.kws.ok;
    kw["voltage"]     = shared.kws.voltage;
    kw["current"]     = shared.kws.current;
    kw["power"]       = shared.kws.power;
    kw["energy"]      = shared.kws.energy;
    kw["temperature"] = shared.kws.temperature;
    kw["pf"]          = shared.kws.pf;
    kw["freq"]        = shared.kws.frequency;
    // Per-phase breakdown (zeros for AC301L).
    kw["vA"] = shared.kws.vA; kw["vB"] = shared.kws.vB; kw["vC"] = shared.kws.vC;
    kw["iA"] = shared.kws.iA; kw["iB"] = shared.kws.iB; kw["iC"] = shared.kws.iC;
    kw["pA"] = shared.kws.pA; kw["pB"] = shared.kws.pB; kw["pC"] = shared.kws.pC;
    xSemaphoreGive(sharedMtx);
  }
  String out;
  serializeJson(doc, out);
  return out;
}

const char* HTML_INDEX = R"HTML(<!doctype html>
<html lang="th"><head><meta charset="utf-8">
<title>%BOARD% — Dashboard</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*,*::before,*::after{box-sizing:border-box}
body{font-family:system-ui,Segoe UI,sans-serif;background:radial-gradient(ellipse at top,#0f1626 0%,#0a0e1a 60%) fixed;color:#f1f5f9;margin:0;min-height:100vh;font-size:14px}
.wrap{max-width:1180px;margin:0 auto;padding:20px 18px 60px}
/* ── Top bar ─────────────────────────────────────────────── */
.bar{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:22px;flex-wrap:wrap}
.brand{display:flex;align-items:center;gap:14px;min-width:0}
.logo{width:46px;height:46px;border-radius:12px;background:linear-gradient(135deg,#22d3ee 0%,#3b82f6 100%);display:grid;place-items:center;box-shadow:0 6px 20px rgba(34,211,238,.35);flex-shrink:0}
.logo svg{width:24px;height:24px;color:#0a0e1a}
.brand h1{margin:0;font-size:20px;color:#f1f5f9;letter-spacing:-.01em}
.brand .sub{font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;margin-top:2px}
.bar .btns{display:flex;gap:8px}
.btn{background:#1e2938;color:#cbd5e1;border:1px solid #2a3850;padding:9px 16px;border-radius:9px;font-weight:600;font-size:13px;cursor:pointer;font-family:inherit;text-decoration:none;display:inline-flex;align-items:center;gap:6px;transition:.15s}
.btn:hover{background:#2a3850;color:#22d3ee;border-color:#22d3ee}
.btn.danger:hover{color:#ef4444;border-color:#ef4444}
/* ── Status strip ────────────────────────────────────────── */
.strip{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:22px}
@media(min-width:760px){.strip{grid-template-columns:repeat(4,1fr)}}
.chip{background:#111729;border:1px solid #1e2938;border-radius:12px;padding:14px;position:relative;overflow:hidden}
.chip::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,var(--accent,#22d3ee)08,transparent 60%);pointer-events:none}
.chip .lbl{font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;display:flex;align-items:center;gap:6px}
.chip .lbl::before{content:'';width:7px;height:7px;border-radius:50%;background:var(--accent,#94a3b8);box-shadow:0 0 8px var(--accent,#94a3b8)}
.chip .val{font-size:15px;font-weight:700;margin-top:6px;letter-spacing:-.01em;font-variant-numeric:tabular-nums}
.chip .det{font-size:11px;color:#64748b;margin-top:3px;font-variant-numeric:tabular-nums}
.chip.ok{--accent:#22c55e}
.chip.warn{--accent:#f59e0b}
.chip.err{--accent:#ef4444}
.chip.info{--accent:#22d3ee}
.pulse{animation:pulse 2s ease-in-out infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
.tlsbadge{display:inline-flex;align-items:center;gap:4px;font-size:9px;font-weight:700;letter-spacing:.08em;padding:2px 7px;border-radius:999px;background:rgba(34,197,94,.18);color:#22c55e;border:1px solid rgba(34,197,94,.4);margin-left:8px;vertical-align:1px}
.tlsbadge::before{content:'';width:4px;height:4px;border-radius:50%;background:#22c55e;box-shadow:0 0 6px #22c55e}
.overlay{position:fixed;inset:0;background:rgba(10,14,26,.92);backdrop-filter:blur(6px);display:none;align-items:center;justify-content:center;z-index:100}
.overlay.show{display:flex}
.overlay-card{background:#111729;border:1px solid #1e2938;border-radius:14px;padding:32px;text-align:center;max-width:380px;width:90%}
.overlay-spinner{width:48px;height:48px;border:3px solid rgba(34,211,238,.2);border-top-color:#22d3ee;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 18px}
@keyframes spin{to{transform:rotate(360deg)}}
.overlay h3{margin:0 0 6px;color:#f1f5f9;font-size:16px}
.overlay p{margin:0;color:#94a3b8;font-size:13px;line-height:1.6}
.overlay .cd{color:#22d3ee;font-variant-numeric:tabular-nums;font-weight:700}
/* ── Sensor cards ────────────────────────────────────────── */
.sensor{background:#111729;border:1px solid #1e2938;border-radius:14px;padding:18px;margin-bottom:16px;position:relative;overflow:hidden}
.sensor::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:linear-gradient(180deg,#22d3ee,#3b82f6)}
.sensor.off::before{background:#ef4444}
.shead{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;gap:10px;flex-wrap:wrap}
.scode{font-size:16px;font-weight:700;letter-spacing:-.01em}
.sstat{display:inline-flex;align-items:center;gap:6px;font-size:11px;color:#22c55e;background:rgba(34,197,94,.1);padding:4px 10px;border-radius:999px;border:1px solid rgba(34,197,94,.3);text-transform:uppercase;letter-spacing:.05em}
.sstat::before{content:'';width:6px;height:6px;border-radius:50%;background:#22c55e;animation:pulse 2s ease-in-out infinite}
.sstat.off{color:#ef4444;background:rgba(239,68,68,.1);border-color:rgba(239,68,68,.3)}
.sstat.off::before{background:#ef4444;animation:none}
.tiles{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
@media(min-width:560px){.tiles{grid-template-columns:repeat(4,1fr)}}
.tiles.k5{grid-template-columns:repeat(2,1fr)}
@media(min-width:560px){.tiles.k5{grid-template-columns:repeat(5,1fr)}}
.tile{background:linear-gradient(135deg,#0d1424 0%,#111729 100%);border:1px solid #1e2938;border-radius:10px;padding:12px;transition:.2s;position:relative;overflow:hidden}
.tile:hover{border-color:var(--c,#22d3ee);transform:translateY(-1px)}
.tile .tlbl{font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;display:flex;align-items:center;gap:5px}
.tile .tlbl::before{content:'';width:5px;height:5px;border-radius:50%;background:var(--c,#22d3ee)}
.tile .num{font-size:22px;font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:-.02em;line-height:1.1;margin-top:8px;color:var(--c,#f1f5f9)}
.tile .unit{font-size:12px;color:#64748b;margin-left:3px;font-weight:500}
.tile.v{--c:#22d3ee}
.tile.i{--c:#a78bfa}
.tile.p{--c:#fbbf24}
.tile.e{--c:#34d399}
.tile.t{--c:#fb7185}
.tile.x .num{color:#475569;font-size:14px}
.extra{display:flex;gap:14px;margin-top:12px;padding-top:12px;border-top:1px dashed #1e2938;font-size:11px;color:#64748b;font-variant-numeric:tabular-nums}
.extra span strong{color:#cbd5e1;font-weight:600}
/* Per-phase breakdown grid — shown only when sensor.phases === 3 */
.pgrid{margin-top:12px;padding-top:12px;border-top:1px dashed #1e2938}
.phdr{font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px;display:flex;align-items:center;gap:8px}
.phdr::before{content:'';width:4px;height:12px;background:linear-gradient(180deg,#22d3ee,#3b82f6);border-radius:2px}
.prow{display:grid;grid-template-columns:32px 1fr 1fr 1fr;gap:6px 12px;font-size:13px;font-variant-numeric:tabular-nums;color:#cbd5e1;padding:6px 0;border-bottom:1px solid rgba(30,41,56,.5)}
.prow:last-child{border-bottom:none}
.prow .plbl{font-weight:700;color:#22d3ee;font-size:14px}
.prow .pcell{display:flex;align-items:baseline;gap:3px}
.prow .pcell .pu{font-size:11px;color:#64748b;font-weight:500}
.modepill{display:inline-flex;align-items:center;gap:5px;font-size:10.5px;font-weight:700;letter-spacing:.06em;padding:3px 9px;border-radius:999px;background:rgba(34,211,238,.12);color:#22d3ee;border:1px solid rgba(34,211,238,.35);text-transform:uppercase;margin-left:10px;vertical-align:2px}
/* ── Footer ──────────────────────────────────────────────── */
.foot{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-top:18px;font-size:11px;color:#64748b}
.live{display:inline-flex;align-items:center;gap:6px}
.live .dot{width:6px;height:6px;border-radius:50%;background:#22c55e;animation:pulse 2s ease-in-out infinite}
.hint{font-size:11px;color:#475569;margin-top:10px;padding:10px 14px;background:rgba(34,211,238,.04);border-left:2px solid #22d3ee;border-radius:4px}
/* Buffer & time-sync info row (replaces the old CPU/RAM/Flash sysrow). */
.bufrow{display:grid;grid-template-columns:1fr;gap:10px;margin:18px 0}
@media(min-width:760px){.bufrow{grid-template-columns:repeat(2,1fr)}}
.bcard{background:#111729;border:1px solid #1e2938;border-radius:12px;padding:14px;position:relative;overflow:hidden;display:flex;align-items:center;gap:14px}
.bcard::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--ac,#22d3ee)}
.bcard.ok::before{background:#22c55e}
.bcard.warn::before{background:#f59e0b}
.bcard.hi::before{background:#ef4444}
.bcard .ic{width:36px;height:36px;border-radius:10px;background:rgba(34,211,238,.12);color:#22d3ee;display:grid;place-items:center;flex-shrink:0}
.bcard.ok .ic{background:rgba(34,197,94,.12);color:#22c55e}
.bcard.warn .ic{background:rgba(245,158,11,.12);color:#f59e0b}
.bcard.hi .ic{background:rgba(239,68,68,.12);color:#ef4444}
.bcard .lbl{font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em}
.bcard .v{font-size:18px;font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:-.01em;margin-top:2px}
.bcard .d{font-size:11px;color:#64748b;margin-top:3px;font-variant-numeric:tabular-nums}
.topic{display:flex;align-items:center;gap:10px;margin-bottom:18px;padding:10px 14px;background:#111729;border:1px solid #1e2938;border-radius:10px;font-size:12px;color:#94a3b8;flex-wrap:wrap}
.topic .icon{width:22px;height:22px;border-radius:6px;background:rgba(34,211,238,.12);display:grid;place-items:center;color:#22d3ee;flex-shrink:0}
.topic .lbl{text-transform:uppercase;letter-spacing:.06em;font-size:10px;font-weight:600;color:#64748b}
.topic code{color:#22d3ee;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;word-break:break-all}
</style></head><body>
<div class="wrap">
  <div class="bar">
    <div class="brand">
      <div class="logo">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
      </div>
      <div>
        <h1 id="board">%BOARD%</h1>
        <div class="sub"><span id="site">%SITE%</span> &middot; firmware %FW%</div>
      </div>
    </div>
    <div class="btns">
      <a href="/settings" class="btn">⚙ Settings</a>
      <button class="btn danger" onclick="restartBoard()">↻ Restart</button>
      <button class="btn" onclick="logout()" title="Sign out">↑ Logout</button>
    </div>
  </div>

  <div class="strip" id="strip"></div>

  <div class="topic" id="topic" style="display:none">
    <div class="icon">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 010 8.49M19.07 4.93a10 10 0 010 14.14M7.76 16.24a6 6 0 010-8.49M4.93 19.07a10 10 0 010-14.14"/></svg>
    </div>
    <span class="lbl">Publishing to</span>
    <code id="topicText">—</code>
  </div>

  <div id="sensors"></div>

  <div class="bufrow" id="bufrow"></div>

  <div class="foot">
    <div class="live"><span class="dot"></span> <span id="live">auto-updating every 2s</span></div>
    <div id="uptime">uptime —</div>
  </div>

  <div class="hint">Hold <strong style="color:#22d3ee">BOOT</strong> button on the board for 3 seconds to enter Setup mode (AP <code style="color:#22d3ee">DGH-Monitor-XXXX</code>, pass <code style="color:#22d3ee">012345678</code>).</div>
</div>

<div id="overlay" class="overlay">
  <div class="overlay-card">
    <div class="overlay-spinner"></div>
    <h3>Restarting board&hellip;</h3>
    <p>Reconnecting after reboot.</p>
    <p style="margin-top:14px">Reloading in <span class="cd" id="ovCd">12</span>s</p>
  </div>
</div>

<script>
const $=id=>document.getElementById(id);
const num=(n,d=2)=>(n==null||isNaN(n))?'—':(+n).toFixed(d);
const upStr=ms=>{const s=Math.floor(ms/1000);const h=Math.floor(s/3600);const m=Math.floor(s%3600/60);return (h?h+'h ':'')+(m||h?m+'m ':'')+(s%60)+'s'};

// POST /restart, show the full-screen spinner overlay, and reload after a
// countdown — long enough for the board to come back online with a fresh IP
// and reseed its task pool.
function restartBoard(){
  if(!confirm('Restart the board?'))return;
  fetch('/restart',{method:'POST'}).catch(()=>{/* expected: socket dies on reboot */});
  document.getElementById('overlay').classList.add('show');
  let secs=12;
  const tick=()=>{
    const el=document.getElementById('ovCd');
    if(secs<=0){location.reload();return}
    el.textContent=secs;secs--;setTimeout(tick,1000);
  };
  tick();
}

// HTTP Basic Auth has no real logout — browsers cache the working credentials
// for the realm and keep replaying them. The XHR open(url, async, user, pwd)
// trick re-fills that cache with deliberately-wrong values, so the next page
// load gets a 401 and the browser shows its login prompt again.
function logout(){
  if(!confirm('Sign out from this board?'))return;
  try{
    const x=new XMLHttpRequest();
    x.open('GET','/logout',true,'logout','logout');
    x.onloadend=()=>{location.href='/?logout='+Date.now()};
    x.send();
  }catch(e){location.href='/?logout='+Date.now()}
}

function tile(cls,label,unit,value){
  return '<div class="tile '+cls+'"><div class="tlbl">'+label+'</div><div class="num">'+value+'<span class="unit">'+unit+'</span></div></div>';
}

function sensorCard(s,extras){
  const ok=s&&s.ok;
  const code=s&&s.code||'—';
  // Mode pill — shown for KWS sensors so the operator can confirm at
  // a glance whether the board is in 1-phase or 3-phase reader mode.
  // s.phases is published by buildStatusJson() under the kws block.
  const phases = s && (s.phases===3 || s.phases===1) ? s.phases : null;
  const modeHtml = phases
    ? '<span class="modepill">'+(phases===3?'3-phase':'1-phase')+'</span>'
    : '';
  const tiles=[
    tile('v','Voltage','V',num(s&&s.voltage,1)),
    tile('i','Current','A',num(s&&s.current,3)),
    tile('p','Power','W',num(s&&s.power,1)),
    tile('e','Energy','kWh',num(s&&s.energy,3)),
  ];
  if(extras&&extras.temp!==undefined){
    tiles.push(tile('t','Temperature','°C',num(extras.temp,1)));
  }
  const xtr=[];
  if(s&&s.pf!=null)xtr.push('<span>PF <strong>'+num(s.pf,2)+'</strong></span>');
  if(s&&s.freq!=null)xtr.push('<span>Freq <strong>'+num(s.freq,1)+' Hz</strong></span>');
  // Per-phase grid — only for 3-phase KWS, only when reading is live.
  // Phase B/C show 0 when unwired which is intentional (mirrors how the
  // central dashboard renders the same data). Skipped entirely when
  // s.vA/iA/pA aren't published (older firmware path).
  let phaseHtml='';
  if(ok && phases===3 && s.vA !== undefined){
    const pn=(v,d)=>(typeof v==='number'?v.toFixed(d):'0');
    const prow=(lbl,v,i,p)=>
      '<div class="prow"><span class="plbl">'+lbl+'</span>'+
      '<span class="pcell">'+pn(v,1)+'<span class="pu">V</span></span>'+
      '<span class="pcell">'+pn(i,3)+'<span class="pu">A</span></span>'+
      '<span class="pcell">'+pn(p,1)+'<span class="pu">W</span></span></div>';
    phaseHtml=
      '<div class="pgrid">'+
        '<div class="phdr">Per-phase</div>'+
        prow('A',s.vA,s.iA,s.pA)+
        prow('B',s.vB,s.iB,s.pB)+
        prow('C',s.vC,s.iC,s.pC)+
      '</div>';
  }
  return '<div class="sensor'+(ok?'':' off')+'">'+
    '<div class="shead">'+
      '<div class="scode">'+code+modeHtml+'</div>'+
      '<span class="sstat'+(ok?'':' off')+'">'+(ok?'reading':'no signal')+'</span>'+
    '</div>'+
    '<div class="tiles'+(extras&&extras.temp!==undefined?' k5':'')+'">'+tiles.join('')+'</div>'+
    (xtr.length?'<div class="extra">'+xtr.join('')+'</div>':'')+
    phaseHtml+
    '</div>';
}

async function tick(){
  try{
    const r=await fetch('/api/status').then(r=>r.json());
    $('board').textContent=r.boardCode||'—';
    $('site').textContent=r.siteCode||'—';

    const tStat=r.transport==='offline'?'err':'ok';
    const tLabel=r.transport==='ethernet'?'Ethernet (LAN)':r.transport==='wifi'?'WiFi':'Offline';
    const tDetail=r.transport==='ethernet'?(r.ethLinkMbps+' Mbps · '+(r.ethFullDuplex?'FD':'HD')):
                  r.transport==='wifi'?(r.wifiSsid+' · '+r.rssi+' dBm'):'no transport';

    const m=r.mqttConnected?'ok':'err';
    $('strip').innerHTML=
      '<div class="chip '+tStat+'">'+
        '<div class="lbl">Active Link</div>'+
        '<div class="val">'+tLabel+'</div>'+
        '<div class="det">'+r.ipAddress+' &middot; '+tDetail+'</div>'+
      '</div>'+
      '<div class="chip '+m+'">'+
        '<div class="lbl">MQTT</div>'+
        '<div class="val">'+(r.mqttConnected?'Connected':'Disconnected')+(r.mqttTls?'<span class="tlsbadge">TLS</span>':'')+'</div>'+
        '<div class="det">'+r.mqttHost+'</div>'+
      '</div>'+
      '<div class="chip info">'+
        '<div class="lbl">Published</div>'+
        '<div class="val">'+(r.totalPublishes||0).toLocaleString()+'</div>'+
        '<div class="det">'+(r.mqttFailures||0)+' failures</div>'+
      '</div>'+
      '<div class="chip info">'+
        '<div class="lbl">Last Reading</div>'+
        '<div class="val">'+Math.floor((r.lastReadingAgoMs||0)/1000)+'s ago</div>'+
        '<div class="det">interval 3s</div>'+
      '</div>';

    if(r.mqttTopic){
      $('topic').style.display='flex';
      $('topicText').textContent=r.mqttTopic;
    }

    $('sensors').innerHTML=
      sensorCard(r.pzem,{})+
      sensorCard(r.kws,{temp:r.kws&&r.kws.temperature});

    // Buffer & time-sync row. Replaces the old CPU/RAM/Flash strip — these
    // values matter for diagnosing outage recovery and timestamp accuracy,
    // both of which directly impact whether telemetry shows up correctly in
    // the dashboard graphs.
    const kb=n=>(n/1024).toFixed(0);
    const pending=r.queuePending||0;
    const qBytes=r.queueBytes||0;
    // 2 MB hard cap on the device → severity tiers.
    const qLevel = pending===0 ? 'ok' : pending<100 ? '' : pending<500 ? 'warn' : 'hi';
    const qIcon =
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v6c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 11v6c0 1.66 4 3 9 3s9-1.34 9-3v-6"/></svg>';
    const tIcon =
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';

    const ntpOk = r.ntpSynced === true;
    const tLevel = ntpOk ? 'ok' : 'warn';

    $('bufrow').innerHTML=
      '<div class="bcard '+qLevel+'">'+
        '<div class="ic">'+qIcon+'</div>'+
        '<div style="min-width:0;flex:1">'+
          '<div class="lbl">Buffer queue</div>'+
          '<div class="v">'+pending.toLocaleString()+
            '<span style="font-size:13px;color:#64748b;font-weight:500;margin-left:4px">records pending</span></div>'+
          '<div class="d">'+kb(qBytes)+' KB on flash · cap 2 MB</div>'+
        '</div>'+
      '</div>'+
      '<div class="bcard '+tLevel+'">'+
        '<div class="ic">'+tIcon+'</div>'+
        '<div style="min-width:0;flex:1">'+
          '<div class="lbl">Time sync</div>'+
          '<div class="v">'+(ntpOk?'Synced':'Not synced')+'</div>'+
          '<div class="d">'+(ntpOk
              ? 'records carry accurate timestamps'
              : 'buffered data may be stamped on arrival')+'</div>'+
        '</div>'+
      '</div>';

    $('uptime').textContent='uptime '+upStr(r.uptimeMs||0);
    $('live').textContent='live · updated '+new Date().toLocaleTimeString();
  }catch(e){
    $('live').textContent='connection error: '+e.message;
  }
}
tick();setInterval(tick,2000);
</script></body></html>)HTML";

// Gate normal-mode admin endpoints behind HTTP Basic Auth when the operator
// has enabled `requireLogin`. The status page itself stays open so dashboards
// can keep polling without credentials.
static bool requireAuth() {
  if (!cfg.requireLogin) return true;
  if (webServer.authenticate(cfg.configUser, cfg.configPassword)) return true;
  webServer.requestAuthentication(BASIC_AUTH, "LED Wall Monitor",
                                  "Please log in with the admin credentials.");
  return false;
}

// ─── Firmware OTA via web UI ────────────────────────────────────────
// Two paths supported:
//   1. Local upload  — operator picks .bin file on their PC and posts it to
//      /api/firmware/upload (multipart). Bytes stream straight into the ESP32
//      Update API.
//   2. Cloud check   — board pings backend `/api/firmware/latest?version=…`,
//      and if a newer release exists the operator can trigger /api/firmware/
//      apply-cloud which downloads + flashes from the backend URL.
// Either path writes to the inactive OTA partition; reboot is automatic on
// success. On failure the active partition stays intact.

// FwState + FirmwareProgress + g_fwProg / g_fwCloudPending / g_fwCloudUrl
// are declared at the top of the file (so both the early onMqttCommand and
// the OTA helpers below can see them).

static const char* fwStateName(FwState s) {
  switch (s) {
    case FW_IDLE:        return "idle";
    case FW_DOWNLOADING: return "downloading";
    case FW_APPLYING:    return "applying";
    case FW_SUCCESS:     return "success";
    case FW_FAILED:      return "failed";
  }
  return "?";
}

// Push the current g_fwProg snapshot to the backend over MQTT so the central
// dashboard can render live OTA progress without polling. Safe to call from
// any context — drops the message silently if MQTT isn't connected. We don't
// throttle here: fwSetState only fires on state transitions + the chunked
// download loop already only nudges done/total without re-invoking us per
// chunk (that's a direct g_fwProg.done = X assignment).
static void publishOtaStatus() {
  if (!mqtt.connected() || mqttOtaStatusTopic[0] == 0) return;
  StaticJsonDocument<320> doc;
  doc["state"]         = fwStateName(g_fwProg.state);
  doc["done"]          = g_fwProg.done;
  doc["total"]         = g_fwProg.total;
  doc["message"]       = g_fwProg.message;
  doc["targetVersion"] = g_fwProg.newVersion;
  doc["currentVersion"]= FIRMWARE_VERSION;
  char buf[320];
  size_t n = serializeJson(doc, buf, sizeof(buf));
  mqtt.publish(mqttOtaStatusTopic, (const uint8_t*)buf, n, false);
}

static void fwSetState(FwState s, size_t done, size_t total, const char* msg) {
  g_fwProg.state = s;
  g_fwProg.done = done;
  g_fwProg.total = total;
  if (msg) {
    strncpy(g_fwProg.message, msg, sizeof(g_fwProg.message) - 1);
    g_fwProg.message[sizeof(g_fwProg.message) - 1] = 0;
  } else {
    g_fwProg.message[0] = 0;
  }
  publishOtaStatus();
}

static String fwProgressJson() {
  StaticJsonDocument<256> doc;
  doc["state"]      = fwStateName(g_fwProg.state);
  doc["done"]       = g_fwProg.done;
  doc["total"]      = g_fwProg.total;
  doc["message"]    = g_fwProg.message;
  doc["newVersion"] = g_fwProg.newVersion;
  doc["current"]    = FIRMWARE_VERSION;
  String s; serializeJson(doc, s); return s;
}

// Handles the streamed multipart-upload chunks from /api/firmware/upload.
static void handleFwUploadChunk() {
  HTTPUpload& upload = webServer.upload();
  if (upload.status == UPLOAD_FILE_START) {
    Serial.printf("OTA(web): upload start, name=%s\n", upload.filename.c_str());
    fwSetState(FW_APPLYING, 0, 0, "Starting update...");
    if (!Update.begin(UPDATE_SIZE_UNKNOWN)) {
      Update.printError(Serial);
      fwSetState(FW_FAILED, 0, 0, "Update.begin failed");
    }
  } else if (upload.status == UPLOAD_FILE_WRITE) {
    if (Update.write(upload.buf, upload.currentSize) != upload.currentSize) {
      Update.printError(Serial);
      fwSetState(FW_FAILED, g_fwProg.done, g_fwProg.total, "write failed");
    } else {
      g_fwProg.done += upload.currentSize;
    }
  } else if (upload.status == UPLOAD_FILE_END) {
    if (Update.end(true)) {
      Serial.printf("OTA(web): upload OK, %u bytes\n", upload.totalSize);
      fwSetState(FW_SUCCESS, upload.totalSize, upload.totalSize, "Update complete — rebooting");
    } else {
      Update.printError(Serial);
      fwSetState(FW_FAILED, g_fwProg.done, g_fwProg.total, "Update.end failed");
    }
  } else if (upload.status == UPLOAD_FILE_ABORTED) {
    Update.end();
    fwSetState(FW_FAILED, g_fwProg.done, g_fwProg.total, "Aborted");
  }
}

// Derive the cloud HTTP base URL from the configured MQTT host. The web
// app + MQTT broker are colocated in our deployments (10.150.219.33,
// 10.88.1.169), so we don't need a separate config field — saves a NVS
// schema bump that would force every existing board to factory-reset.
static String fwCloudBase() {
  if (cfg.mqttHost[0] == 0) return "";
  return String("http://") + cfg.mqttHost;
}

// Queries the backend for the latest released firmware version.
// Result lands in g_fwProg.newVersion + g_fwCloudUrl. Returns false on error.
static bool fwCheckRemote(String& errOut) {
  String base = fwCloudBase();
  if (base.length() == 0) {
    errOut = "MQTT host not configured (used as cloud base)";
    return false;
  }
  HTTPClient http;
  String url = base + "/api/firmware/latest?board="
             + cfg.boardCode + "&current=" + FIRMWARE_VERSION;
  http.begin(url);
  int status = http.GET();
  if (status != 200) {
    errOut = "HTTP " + String(status);
    http.end();
    return false;
  }
  String body = http.getString();
  http.end();
  StaticJsonDocument<512> doc;
  if (deserializeJson(doc, body)) {
    errOut = "Bad JSON";
    return false;
  }
  const char* v = doc["version"] | "";
  const char* u = doc["downloadUrl"] | "";
  strncpy(g_fwProg.newVersion, v, sizeof(g_fwProg.newVersion) - 1);
  g_fwProg.newVersion[sizeof(g_fwProg.newVersion) - 1] = 0;
  strncpy(g_fwCloudUrl, u, sizeof(g_fwCloudUrl) - 1);
  g_fwCloudUrl[sizeof(g_fwCloudUrl) - 1] = 0;
  return true;
}

// Streams firmware from the URL stored in g_fwCloudUrl directly into the
// Update API. Runs in the main loop (after the HTTP handler returns 200 to
// the client) — see `handleCloudUpdateTick()`.
//
// Reads in small chunks and pumps webServer.handleClient() between each so
// the browser can keep polling `/api/firmware/progress` and render progress
// in real time. `Update.writeStream(...)` would be simpler but blocks the
// main loop for the entire download (~5-30 s) — the dashboard would freeze
// with no feedback.
static void fwDownloadAndApplyCloud() {
  if (g_fwCloudUrl[0] == 0) {
    fwSetState(FW_FAILED, 0, 0, "Target URL missing");
    return;
  }
  fwSetState(FW_DOWNLOADING, 0, 0, "Starting download...");
  HTTPClient http;
  http.begin(g_fwCloudUrl);
  http.setTimeout(30000);
  // Tell the server we can resume — and disable any caches in front of it.
  http.useHTTP10(true);
  int status = http.GET();
  if (status != 200) {
    char msg[64]; snprintf(msg, sizeof(msg), "HTTP %d", status);
    fwSetState(FW_FAILED, 0, 0, msg);
    http.end();
    return;
  }
  int total = http.getSize();
  if (total <= 0) {
    fwSetState(FW_FAILED, 0, 0, "Content-Length missing");
    http.end();
    return;
  }
  if (!Update.begin(total)) {
    Update.printError(Serial);
    fwSetState(FW_FAILED, 0, total, "Update.begin failed");
    http.end();
    return;
  }

  // Chunked copy: small buffer (2 KB fits well inside an ESP32 TCP window),
  // updates progress, pumps web server, and pets the watchdog every loop so
  // the OS doesn't think we've hung. Re-checks http.connected() so a
  // dropped link breaks out cleanly instead of spinning forever.
  WiFiClient* stream = http.getStreamPtr();
  uint8_t buf[2048];
  size_t written = 0;
  fwSetState(FW_DOWNLOADING, 0, (size_t)total, "Downloading");
  unsigned long lastMqttPub = 0;
  while (http.connected() && written < (size_t)total) {
    size_t avail = stream->available();
    if (avail > 0) {
      size_t n = stream->readBytes(buf, min((size_t)sizeof(buf), avail));
      if (n > 0) {
        if (Update.write(buf, n) != n) {
          Update.printError(Serial);
          Update.end();
          http.end();
          fwSetState(FW_FAILED, written, total, "Flash write failed");
          return;
        }
        written += n;
        // Update the global progress counter on EVERY chunk (no throttle).
        // An earlier 200ms throttle would sometimes drop the very last
        // chunk's update so the dashboard stuck at "99%" right before the
        // board rebooted into the new firmware.
        g_fwProg.done = written;
      }
    } else {
      // No data ready yet — yield a slice. The TCP stack will fill the
      // buffer in the meantime.
      delay(2);
    }
    webServer.handleClient();   // let /api/firmware/progress respond
    // Throttle MQTT progress to ~2 Hz so the central dashboard sees motion
    // without us swamping the broker (a 1 MB image at 2 KB chunks = ~500
    // writes; one publish per write would push >500 messages per OTA).
    if (millis() - lastMqttPub >= 500) {
      lastMqttPub = millis();
      publishOtaStatus();
    }
    esp_task_wdt_reset();
  }
  http.end();

  // Pump once with done==total so the next browser poll sees 100% before
  // we move into the APPLYING state.
  g_fwProg.done = (size_t)total;
  webServer.handleClient();
  delay(150);
  webServer.handleClient();

  if (written != (size_t)total) {
    Update.end();
    char msg[64]; snprintf(msg, sizeof(msg), "Wrote only %u/%d bytes", (unsigned)written, total);
    fwSetState(FW_FAILED, written, total, msg);
    return;
  }

  // Last leg: Update.end() verifies + commits + flips the boot partition.
  // This blocks ~1-2 s and can't be pumped — the spinner in the UI carries
  // through this state.
  fwSetState(FW_APPLYING, written, total, "Verifying & committing...");
  // One extra handleClient() so the "applying" state propagates to clients
  // before we go silent.
  webServer.handleClient();
  if (!Update.end(true)) {
    Update.printError(Serial);
    fwSetState(FW_FAILED, written, total, "Update.end failed");
    return;
  }
  fwSetState(FW_SUCCESS, total, total, "Update complete — rebooting");
  // Pump once more so the browser sees success before the reboot kills
  // the connection.
  webServer.handleClient();
  delay(800);
  ESP.restart();
}

// Polled from the main loop so the cloud-download work happens outside the
// HTTP handler context (the handler returns 200 immediately so the operator's
// browser doesn't time out during a 60-second flash).
static void handleCloudUpdateTick() {
  if (!g_fwCloudPending) return;
  g_fwCloudPending = false;
  fwDownloadAndApplyCloud();
}

// Self-contained firmware UI designed to live INSIDE the /settings page,
// inserted as the last entry in the form's section grid so it sits flush
// with Identity / WiFi / MQTT / Login & Security cards. Uses the portal's
// `.section.span-2` styling for visual consistency.
//
// Notes:
//   - The wrapper is a .section (not a form) because HTML5 disallows nesting
//     forms — the upload runs through a button click handler instead.
//   - All firmware-specific CSS is prefixed `fw-` so it can't collide with
//     the portal's own .row / .msg / .spinner for unrelated things.
static const char* HTML_FIRMWARE = R"HTML(<div class="section span-2" id="fwblock">
<style>
#fwblock .fw-head{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}
#fwblock .fw-label{color:#8b949e;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;display:block}
#fwblock .fw-val{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#facc15;font-weight:700;font-size:18px}
#fwblock button.fw-btn{background:#22d3ee;color:#000;border:0;padding:9px 16px;border-radius:8px;font-weight:700;cursor:pointer;font-family:inherit;font-size:13px}
#fwblock button.fw-btn.ghost{background:transparent;border:1px solid #30363d;color:#e6edf3}
#fwblock button.fw-btn:disabled{opacity:0.5;cursor:not-allowed}
#fwblock input[type=file]{font-family:inherit;font-size:13px;color:#e6edf3}
#fwblock .fw-bar{height:8px;background:#0d1117;border-radius:4px;overflow:hidden;position:relative}
#fwblock .fw-bar>div{height:100%;background:linear-gradient(90deg,#22d3ee,#0ea5e9);width:0;transition:width 0.3s}
#fwblock .fw-bar.indet>div{width:30%;animation:fw-slide 1.2s ease-in-out infinite;background:linear-gradient(90deg,transparent,#22d3ee,transparent)}
@keyframes fw-slide{0%{margin-left:-30%}100%{margin-left:100%}}
#fwblock .fw-msg{font-size:13px;color:#8b949e;min-height:18px}
#fwblock .fw-pct{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#22d3ee;font-weight:700;margin-left:8px}
#fwblock .fw-spinner{display:inline-block;width:13px;height:13px;border:2px solid #1e2938;border-top-color:#22d3ee;border-radius:50%;animation:fw-spin 0.7s linear infinite;vertical-align:-2px;margin-right:6px}
@keyframes fw-spin{to{transform:rotate(360deg)}}
#fwblock .fw-state-tag{display:inline-block;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-right:8px}
#fwblock .fw-state-downloading{background:rgba(34,211,238,.15);color:#22d3ee}
#fwblock .fw-state-applying{background:rgba(250,204,21,.15);color:#facc15}
#fwblock .fw-state-success{background:rgba(74,222,128,.15);color:#4ade80}
#fwblock .fw-state-failed{background:rgba(239,68,68,.15);color:#fca5a5}
/* The banner uses `position:relative` so the absolutely-positioned close
   button can park itself in the top-right corner. With the previous
   flex/margin-left:auto layout, the × sat next to the body content +
   10px gap + 14px banner padding — which read as "floating in the middle"
   on the user's screen. Absolute positioning pins it visually flush right. */
#fwblock .fw-banner{position:relative;margin-top:14px;padding:12px 38px 12px 14px;border-radius:10px;border:1px solid;font-size:13px}
#fwblock .fw-banner.info{background:rgba(34,211,238,.08);border-color:rgba(34,211,238,.3);color:#cbd5e1}
#fwblock .fw-banner.update{background:rgba(250,204,21,.10);border-color:rgba(250,204,21,.4);color:#facc15}
#fwblock .fw-banner.err{background:rgba(239,68,68,.08);border-color:rgba(239,68,68,.3);color:#fca5a5}
#fwblock .fw-banner-body{min-width:0}
#fwblock .fw-banner-close{position:absolute;top:6px;right:6px;background:transparent;border:0;color:inherit;cursor:pointer;font-size:18px;line-height:1;opacity:.55;padding:4px 8px;border-radius:6px}
#fwblock .fw-banner-close:hover{opacity:1;background:rgba(255,255,255,.05)}
#fwblock details summary{cursor:pointer;color:#8b949e;font-size:12px;list-style:none;padding:8px 0;border-top:1px solid #1e2938;margin-top:14px}
#fwblock details summary::-webkit-details-marker{display:none}
#fwblock details summary::before{content:'+ ';color:#22d3ee;font-weight:700}
#fwblock details[open] summary::before{content:'− '}
#fwblock details[open] summary{margin-bottom:10px}
</style>

<h2>Firmware Update</h2>

<div class="fw-head">
  <div>
    <span class="fw-label">Current version</span>
    <div class="fw-val" id="fw-current">%FW%</div>
  </div>
  <button type="button" onclick="fwCheckCloud()" id="fw-chkbtn" class="fw-btn ghost">Check for updates</button>
</div>

<div id="fw-result"></div>

<div id="fw-progCard" style="display:none;margin-top:14px;padding-top:14px;border-top:1px solid #1e2938">
  <div class="fw-msg" id="fw-progMsg" style="margin-bottom:8px">—</div>
  <div class="fw-bar"><div id="fw-progBar"></div></div>
</div>

<details>
  <summary>Upload .bin from disk (advanced)</summary>
  <p style="font-size:12px;color:#8b949e;margin:0 0 10px">Pick the <code>firmware.bin</code> built from Arduino IDE / PlatformIO.</p>
  <!-- Plain <div> not <form>: this whole block is rendered inside the
       settings page's main <form id="f">, and HTML5 forbids nested forms.
       The Upload button runs an explicit JS click handler instead. -->
  <div id="fw-upform-wrap" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
    <input type="file" id="fw-file" name="firmware" accept=".bin" form="__fw_orphan" style="flex:1;min-width:200px">
    <button type="button" id="fw-upbtn" class="fw-btn ghost">Upload &amp; install</button>
  </div>
</details>

</div>
<script>
(function(){
  const $ = id => document.getElementById(id);
  const fmt = n => (n/1024).toFixed(1)+' KB';
  const STATE_LABELS = {
    idle:        'Installing',
    downloading: 'Downloading',
    applying:    'Writing flash',
    success:     'Success',
    failed:      'Failed',
  };
  function renderProgress(j){
    const msgEl = $('fw-progMsg');
    const barEl = $('fw-progBar');
    const barWrap = barEl.parentElement;
    const stateLabel = STATE_LABELS[j.state] || j.state;
    const tag = '<span class="fw-state-tag fw-state-'+j.state+'">'+stateLabel+'</span>';
    if(j.state === 'downloading' && j.total){
      const pct = Math.min(100, j.done*100/j.total);
      msgEl.innerHTML = tag +
        '<span class="fw-spinner"></span>' + (j.message||'Downloading') +
        ' <span class="fw-pct">'+pct.toFixed(0)+'%</span> ' +
        '('+fmt(j.done)+' / '+fmt(j.total)+')';
      barEl.style.width = pct + '%';
      barWrap.classList.remove('indet');
    } else if(j.state === 'downloading'){
      // Pre-progress: total unknown yet, keep the bar moving so the user
      // doesn't think the UI froze.
      msgEl.innerHTML = tag + '<span class="fw-spinner"></span>' +
        (j.message||'Starting...');
      barWrap.classList.add('indet');
    } else if(j.state === 'applying'){
      msgEl.innerHTML = tag + '<span class="fw-spinner"></span>' +
        (j.message||'Writing data...') + ' — do not close this page';
      barWrap.classList.add('indet');
    } else if(j.state === 'success'){
      msgEl.innerHTML = tag + 'Done — board is restarting, will be back in ~15 s';
      barEl.style.width = '100%';
      barWrap.classList.remove('indet');
    } else if(j.state === 'failed'){
      msgEl.innerHTML = tag + (j.message || 'Error');
      barWrap.classList.remove('indet');
    } else {
      msgEl.innerHTML = tag + '<span class="fw-spinner"></span>' + (j.message || '');
      barWrap.classList.add('indet');
    }
  }

  // Fetch with hard timeout. Without this, a reboot in the middle of a
  // download leaves the browser hanging on a never-returning request and
  // the reboot-detect logic below never gets a chance to run.
  // Accepts the usual fetch() options so callers can POST etc — an earlier
  // version silently dropped them, turning the apply-cloud POST into a GET
  // and leaving the board's state stuck at idle forever.
  async function fetchTimeout(url, ms, opts){
    const ctrl = new AbortController();
    const tm = setTimeout(()=>ctrl.abort(), ms);
    try { return await fetch(url, Object.assign({}, opts || {}, { signal: ctrl.signal })); }
    finally { clearTimeout(tm); }
  }

  // Reboot-during-flash detection: when the last successful poll showed the
  // download well underway (≥80%) or `applying`, and we then lose contact
  // for ~1.5 s, the only thing that can have happened is the board rebooted
  // into the new firmware. Flip the UI to success so the user isn't left
  // staring at 96%.
  let lastSeen = null;
  let lostStreakMs = 0;
  async function poll(){
    try{
      const r = await fetchTimeout('/api/firmware/progress', 1500);
      const j = await r.json();
      // Reboot-into-new-firmware detection: when the running version
      // (`current` field) changes between polls, the board has finished
      // OTA and is now serving from the new flash partition. The board
      // itself can't report `success` reliably because that state is
      // wiped by the reboot — we have to spot it client-side.
      if (lastSeen && lastSeen.current && j.current &&
          lastSeen.current !== j.current) {
        renderProgress({state:'success', done:1, total:1,
                        message:'Update complete — now running ' + j.current});
        setTimeout(()=>location.href='/', 6000);
        return;
      }
      lastSeen = j; lostStreakMs = 0;
      $('fw-progCard').style.display = 'block';
      renderProgress(j);
      if(j.state === 'success'){ setTimeout(()=>location.href='/', 15000); return; }
      if(j.state === 'failed') return;
    }catch(e){
      lostStreakMs += 900;
      const wasNearDone = lastSeen &&
        ((lastSeen.state === 'downloading' && lastSeen.total && (lastSeen.done / lastSeen.total) >= 0.8) ||
         lastSeen.state === 'applying');
      if(wasNearDone && lostStreakMs >= 1500){
        renderProgress({state:'success', done:lastSeen.total||1, total:lastSeen.total||1,
                        message:'Update complete — board is restarting'});
        setTimeout(()=>location.href='/', 15000);
        return;
      }
      // Always overwrite the message — an earlier `!fw-spinner` gate meant
      // the catch branch was no-op'd as long as the seed render had set a
      // spinner (which it always does), so the UI looked frozen on
      // "Installing" while the board was actually busy with http.GET.
      const msgEl = $('fw-progMsg');
      if(msgEl){
        const sinceStart = Math.round(lostStreakMs/1000);
        msgEl.innerHTML = '<span class="fw-spinner"></span>Waiting for board... ('+sinceStart+'s)';
        $('fw-progBar').parentElement.classList.add('indet');
      }
    }
    setTimeout(poll, 900);
  }
  // Button click handler — would normally be a <form submit> handler, but
  // this block lives inside the settings page's main <form>, and HTML
  // doesn't allow nested forms.
  $('fw-upbtn').addEventListener('click', async ()=>{
    const f = $('fw-file').files[0];
    if(!f){ alert('Please pick a .bin file first'); return; }
    $('fw-upbtn').disabled = true;
    $('fw-progCard').style.display = 'block';
    $('fw-progMsg').textContent = 'Uploading '+fmt(f.size)+'...';
    poll();
    const fd = new FormData(); fd.append('firmware', f);
    try{
      const r = await fetch('/api/firmware/upload',{method:'POST',body:fd});
      if(!r.ok) $('fw-progMsg').textContent = 'Upload failed: '+r.status;
    }catch(err){ $('fw-progMsg').textContent = 'Network error: '+err; }
  });
  // Renders a closeable banner inside #fw-result. Kind is "info" | "update"
  // | "err" and controls the colour.
  function showResult(kind, body){
    const el = $('fw-result');
    el.innerHTML =
      '<div class="fw-banner '+kind+'">' +
        '<div class="fw-banner-body">'+body+'</div>' +
        '<button class="fw-banner-close" onclick="fwClearResult()" title="Close">×</button>' +
      '</div>';
  }
  window.fwClearResult = function(){ $('fw-result').innerHTML = ''; };

  window.fwCheckCloud = async function(){
    const btn = $('fw-chkbtn'); btn.disabled = true;
    showResult('info', '<span class="fw-spinner"></span>Checking...');
    try{
      const r = await fetch('/api/firmware/check');
      const j = await r.json();
      if(j.hasUpdate){
        showResult('update',
          '<div style="font-weight:700;margin-bottom:6px">New version available: ' +
            '<span class="fw-val" style="font-size:14px">'+j.version+'</span></div>' +
          '<button onclick="fwApplyCloud()" id="fw-applybtn" class="fw-btn" ' +
                  'style="background:#facc15;margin-top:4px">Download &amp; install</button>');
      } else if(j.error){
        showResult('err', 'Check failed: '+j.error);
      } else {
        showResult('info', "You're on the latest version");
      }
    }catch(e){ showResult('err', 'Network error: '+e); }
    btn.disabled = false;
  };

  window.fwApplyCloud = async function(){
    if(!confirm('Install the new version? The board will reboot automatically when finished. Continue?')) return;
    const applyBtn = $('fw-applybtn');
    if(applyBtn) applyBtn.disabled = true;
    fwClearResult();
    $('fw-progCard').style.display = 'block';
    // Show a clear "installing" state the instant the user confirms —
    // before the first poll round-trip — so they don't see an empty panel
    // wondering if anything happened. Pre-progress state shows an
    // indeterminate bar + spinner.
    renderProgress({state:'idle', message:'Installing firmware... do not close this page'});
    poll();
    try{ await fetchTimeout('/api/firmware/apply-cloud', 5000, {method:'POST'}); }
    catch(e){ /* poll() handles its own retries */ }
  };
})();
</script>)HTML";

void startWebServer() {
  if (g_webServerStarted) return;
  webServer.on("/", HTTP_GET, []() {
    if (!requireAuth()) return;
    String html = HTML_INDEX;
    html.replace("%BOARD%", cfg.boardCode);
    html.replace("%SITE%", cfg.siteCode);
    html.replace("%FW%", FIRMWARE_VERSION);
    webServer.send(200, "text/html; charset=utf-8", html);
  });
  webServer.on("/api/status", HTTP_GET, []() {
    if (!requireAuth()) return;
    webServer.send(200, "application/json", buildStatusJson());
  });
  webServer.on("/restart", HTTP_POST, []() {
    if (!requireAuth()) return;
    webServer.send(200, "text/plain", "restarting");
    delay(200);
    ESP.restart();
  });
  // Always-401 endpoint used by the dashboard's logout() trick: the browser
  // caches whatever credentials were sent last, so we feed it a wrong pair
  // and reload to force the auth prompt to reappear.
  webServer.on("/logout", HTTP_GET, []() {
    webServer.sendHeader("WWW-Authenticate", "Basic realm=\"LED Wall Monitor\"");
    webServer.send(401, "text/html",
                   "<html><body style='font-family:system-ui;background:#0a0e1a;color:#f1f5f9;text-align:center;padding-top:60px'>"
                   "<h2 style='color:#22d3ee'>Signed out</h2>"
                   "<p><a href='/' style='color:#22d3ee'>Sign in again</a></p></body></html>");
  });
  // Settings page — same form as the AP-mode portal, but served on the
  // production network so operators can edit config without dropping the
  // device offline first.
  webServer.on("/settings", HTTP_GET, []() {
    if (!requireAuth()) return;
    String html = renderConfigForm("/api/config", "/restart", "/api/factory-reset");
    // Splice the firmware UI in as the LAST entry inside the form's section
    // grid, right after Login & Security. The injection point targets the
    // closing </div> of the grid container — the one that appears just
    // before <div class="actions">. AP-mode portal also calls
    // renderConfigForm() but has no internet route, so the injection only
    // happens in the normal-mode handler here.
    String fwSection = HTML_FIRMWARE;
    fwSection.replace("%FW%", FIRMWARE_VERSION);
    html.replace("  </div>\n  <div class=\"actions\">",
                 "  " + fwSection + "\n  </div>\n  <div class=\"actions\">");
    webServer.send(200, "text/html; charset=utf-8", html);
  });
  // /firmware kept as a permanent redirect — older bookmarks land on the
  // settings page where the firmware UI now lives.
  webServer.on("/firmware", HTTP_GET, []() {
    if (!requireAuth()) return;
    webServer.sendHeader("Location", "/settings#fwblock");
    webServer.send(302, "text/plain", "");
  });
  webServer.on("/api/config", HTTP_POST, []() {
    if (!requireAuth()) return;
    String err;
    if (!applyConfigFromJson(webServer.arg("plain").c_str(), err)) {
      webServer.send(400, "text/plain", err);
      return;
    }
    webServer.send(200, "application/json", "{\"ok\":true}");
    Serial.println("Settings: saved — restarting in 2s");
    delay(2000);
    ESP.restart();
  });
  webServer.on("/api/factory-reset", HTTP_POST, []() {
    if (!requireAuth()) return;
    factoryResetConfig();
    webServer.send(200, "text/plain", "factory reset — rebooting");
    delay(400);
    ESP.restart();
  });

  // ── Firmware OTA endpoints (UI is rendered inline inside /settings) ──
  // Multipart upload: the second lambda runs once per chunk (handleFwUploadChunk).
  // The first lambda only runs after the whole upload completed.
  webServer.on("/api/firmware/upload", HTTP_POST,
    []() {
      if (!requireAuth()) return;
      // Tell the browser whether the flash worked — it polls /progress for detail.
      bool ok = (g_fwProg.state == FW_SUCCESS);
      webServer.send(ok ? 200 : 500, "application/json",
                     ok ? "{\"ok\":true}" : "{\"ok\":false}");
      if (ok) {
        delay(500);
        ESP.restart();
      }
    },
    handleFwUploadChunk);
  webServer.on("/api/firmware/check", HTTP_GET, []() {
    if (!requireAuth()) return;
    String err;
    bool ok = fwCheckRemote(err);
    StaticJsonDocument<256> doc;
    if (!ok) {
      doc["hasUpdate"] = false;
      doc["error"] = err;
    } else {
      bool newer = strcmp(g_fwProg.newVersion, FIRMWARE_VERSION) != 0
                && g_fwProg.newVersion[0] != 0;
      doc["hasUpdate"] = newer;
      doc["version"] = g_fwProg.newVersion;
    }
    String s; serializeJson(doc, s);
    webServer.send(200, "application/json", s);
  });
  webServer.on("/api/firmware/apply-cloud", HTTP_POST, []() {
    if (!requireAuth()) return;
    if (g_fwProg.state == FW_DOWNLOADING || g_fwProg.state == FW_APPLYING) {
      webServer.send(409, "application/json", "{\"ok\":false,\"error\":\"in progress\"}");
      return;
    }
    g_fwCloudPending = true;
    webServer.send(200, "application/json", "{\"ok\":true}");
  });
  webServer.on("/api/firmware/progress", HTTP_GET, []() {
    // Always-readable so the upload page can poll without re-auth churn.
    webServer.send(200, "application/json", fwProgressJson());
  });

  webServer.begin();
  g_webServerStarted = true;
  Serial.printf("Web UI: http://%s (%s)\n",
                activeLocalIp().toString().c_str(), activeTransport());
}

// ─── Arduino lifecycle ──────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("\n=== LED-Wall-Monitor firmware ===");
  Serial.printf("FW=%s\n", FIRMWARE_VERSION);

  buzzerBegin();
  beepN(1);   // "starting up"

  loadConfig();

  // Decide whether to drop into the AP-mode setup portal:
  //   1. BOOT button (GPIO 0) held for 3s during power-up — manual override.
  //   2. The web UI's /enter-config endpoint asked us to (one-shot NVS flag).
  bool toPortal = bootButtonHeldAtStartup();
  if (cfg.wantsPortalOnNextBoot) {
    Serial.println("Boot: wantsPortalOnNextBoot flag set — entering portal");
    cfg.wantsPortalOnNextBoot = false;
    saveConfig();
    toPortal = true;
  }
  if (toPortal) {
    runConfigPortal();   // never returns
  }

  Serial.printf("Board=%s  Site=%s\n", cfg.boardCode, cfg.siteCode);
  if (cfg.mqttTopic[0] != '\0') {
    strlcpy(mqttTopic, cfg.mqttTopic, sizeof(mqttTopic));
    Serial.printf("MQTT topic (custom): %s\n", mqttTopic);
  } else {
    snprintf(mqttTopic, sizeof(mqttTopic),
             "sites/%s/boards/%s/telemetry", cfg.siteCode, cfg.boardCode);
    Serial.printf("MQTT topic (default): %s\n", mqttTopic);
  }
  // Derived control + status topics, anchored to the same site/board path as
  // telemetry. The backend publishes commands to `.../cmd` and listens on
  // `.../ota-status`. These run in parallel to the telemetry topic, so even
  // if the operator has set a custom telemetry topic we still address cmd /
  // ota-status through the canonical site/board path.
  snprintf(mqttCmdTopic, sizeof(mqttCmdTopic),
           "sites/%s/boards/%s/cmd", cfg.siteCode, cfg.boardCode);
  snprintf(mqttOtaStatusTopic, sizeof(mqttOtaStatusTopic),
           "sites/%s/boards/%s/ota-status", cfg.siteCode, cfg.boardCode);
  Serial.printf("MQTT cmd: %s\n", mqttCmdTopic);
  Serial.printf("MQTT ota-status: %s\n", mqttOtaStatusTopic);

  snprintf(clientId, sizeof(clientId), "%s-%06X",
           cfg.boardCode, (uint32_t)ESP.getEfuseMac());

  Serial2.begin(9600, SERIAL_8N1, KWS_RX_PIN, KWS_TX_PIN);
  kws.begin(cfg.kwsSlaveAddr, Serial2);

  sharedMtx = xSemaphoreCreateMutex();
  // Arduino Core 3.x initialises TWDT before setup() runs with its own
  // (short, ~5 s) default. `esp_task_wdt_init()` then returns
  // ESP_ERR_INVALID_STATE ("TWDT already initialized") and our 30 s timeout
  // is silently ignored — which is exactly what produced the boot-loop the
  // first time around: Modbus reads against an unplugged PZEM/KWS take
  // ~2 s × N registers and overflow the 5 s default. `reconfigure()` updates
  // the existing instance in place, which always succeeds.
  esp_task_wdt_config_t wdtCfg = {
    .timeout_ms = WDT_TIMEOUT_S * 1000,
    .idle_core_mask = 0,
    .trigger_panic = true,
  };
  esp_err_t wdtErr = esp_task_wdt_reconfigure(&wdtCfg);
  if (wdtErr != ESP_OK) {
    // Older cores (pre-IDF 5) won't have reconfigure; fall back to init.
    esp_task_wdt_init(&wdtCfg);
  }
  Serial.printf("WDT: timeout=%us trigger_panic=true\n", WDT_TIMEOUT_S);

  // Register a single event handler that covers both ETH and WiFi events.
  Network.onEvent(onNetworkEvent);

  // Bring Ethernet up first. If a cable is plugged in we'll usually have an IP
  // within a couple of seconds and can skip the WiFi radio entirely.
  Serial.println("ETH: begin");
  if (!ETH.begin(ETH_PHY_TYPE_HKL, ETH_PHY_ADDR_HKL, ETH_PHY_MDC_HKL,
                 ETH_PHY_MDIO_HKL, ETH_PHY_POWER_HKL, ETH_CLK_MODE_HKL)) {
    Serial.println("ETH: begin() failed - WiFi only");
  } else if (isStaticIpMode()) {
    IPAddress ip = parseIpOrZero(cfg.staticIp);
    IPAddress gw = parseIpOrZero(cfg.staticGateway);
    IPAddress sn = parseIpOrZero(cfg.staticSubnet);
    IPAddress dns = parseIpOrZero(cfg.staticDns);
    if (ip != IPAddress((uint32_t)0)) {
      ETH.config(ip, gw, sn, dns);
      Serial.printf("ETH: static IP=%s gw=%s\n",
                    ip.toString().c_str(), gw.toString().c_str());
    }
  }

  // Wait briefly for the PHY to negotiate. If no cable is connected we drop
  // through quickly and let WiFi take over.
  uint32_t ethWaitStart = millis();
  while (!g_ethHasIp && millis() - ethWaitStart < 4000) {
    delay(100);
  }

  if (!g_ethHasIp) {
    Serial.println("ETH: no IP within 4s - bringing up WiFi");
    connectWiFi();
  }

  // mDNS responder — advertises the board as `<DGH-Monitor-XXXX>.local`
  // so the technician can reach the web UI without knowing the DHCP IP.
  // We start it here (after either ETH or WiFi has an IP) so the responder
  // listens on whichever interface actually came up. Hostname matches what
  // portal mode advertises so a single bookmark works in both modes.
  {
    String host = mdnsHostname();
    if (MDNS.begin(host.c_str())) {
      MDNS.addService("http", "tcp", 80);
      Serial.printf("Web UI: http://%s/ (or http://%s.local/)\n",
                    activeLocalIp().toString().c_str(), host.c_str());
    } else {
      Serial.println("mDNS: begin() failed");
    }
  }

  // Time sync — try in this order:
  //   1. NTP via the broker host (works when server runs chronyd / ntpd)
  //   2. NTP via public pools (works when outbound UDP 123 isn't blocked)
  //   3. HTTP /api/time on the broker host (always works if the web app is up)
  // mqttTask keeps retrying the chain in the background until something sticks.
  configTime(0, 0, cfg.mqttHost, "pool.ntp.org", "time.google.com");
  uint32_t ntpStart = millis();
  while (!ntpSynced() && millis() - ntpStart < 8000) {
    delay(100);
  }
  if (!ntpSynced()) {
    Serial.println("NTP: not synced within 8s — trying HTTP fallback");
    fetchTimeOverHttp();
  }
  time_t nowEpoch = time(nullptr);
  Serial.printf("Time: %s (epoch=%ld)\n",
                ntpSynced() ? "synced" : "NOT synced — will retry in background",
                (long)nowEpoch);

  // Persistent telemetry queue (LittleFS) — collects readings while MQTT
  // is offline and replays on reconnect.
  tqBegin();

  // Bind PubSubClient to the right transport: plain TCP, or TLS via
  // WiFiClientSecure. When a CA cert is provided we verify the chain;
  // otherwise we only encrypt (setInsecure) — good enough for a local broker
  // but not for the public internet.
  if (cfg.mqttTls) {
    if (cfg.mqttCaCert[0] != '\0') {
      wifiClientSecure.setCACert(cfg.mqttCaCert);
      Serial.println("MQTT: TLS enabled (CA cert verification)");
    } else {
      wifiClientSecure.setInsecure();
      Serial.println("MQTT: TLS enabled (insecure — no cert verification)");
    }
    mqtt.setClient(wifiClientSecure);
  } else {
    mqtt.setClient(wifiClient);
    Serial.println("MQTT: plaintext (no TLS)");
  }
  mqtt.setServer(cfg.mqttHost, cfg.mqttPort);
  mqtt.setKeepAlive(30);
  mqtt.setBufferSize(1024);
  mqtt.setCallback(onMqttCommand);

  ArduinoOTA.setHostname(cfg.boardCode);
  ArduinoOTA.onStart([]() {
    Serial.println("OTA: start - suspending watchdog and sensor task");
    // Flash writes block the running task for >30s on a 1MB image. Detach
    // the running task from the WDT so the watchdog doesn't reset the
    // board mid-upload. Re-armed by ESP.restart() at end of OTA.
    esp_task_wdt_delete(NULL);
  });
  ArduinoOTA.onEnd([]()   { Serial.println("OTA: done - restarting"); });
  ArduinoOTA.onError([](ota_error_t err) {
    Serial.printf("OTA: error %u\n", err);
    // Re-subscribe so the WDT protects us again if the user aborted upload.
    esp_task_wdt_add(NULL);
  });
  ArduinoOTA.begin();

  if (isOnline()) startWebServer();

  xTaskCreatePinnedToCore(sensorTask, "sensor", 6144, nullptr, 1, nullptr, 0);
  xTaskCreatePinnedToCore(mqttTask,   "mqtt",   8192, nullptr, 1, nullptr, 1);
}

void loop() {
  // All work happens in FreeRTOS tasks. Idle the main loop.
  vTaskDelay(pdMS_TO_TICKS(1000));
}
