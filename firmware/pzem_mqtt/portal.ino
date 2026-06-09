// AP-mode config portal: WiFi AP + DNS captive portal + auth-gated web UI for
// editing every persisted setting. See config.h for the schema and pzem_mqtt.ino
// for the integration points (boot-button detection, /enter-config endpoint).

#include "config.h"
#include <Preferences.h>
#include <WiFi.h>
#include <DNSServer.h>
#include <WebServer.h>
#include <ArduinoJson.h>
#include <ESPmDNS.h>
#include <esp_task_wdt.h>
#include "secrets.h"

Config cfg;
const uint32_t CONFIG_MAGIC = 0xC0DE0005;   // bumped: added mqttTls + mqttCaCert

static Preferences gPrefs;

// ─── NVS load / save ───────────────────────────────────────────────
static void applyDefaults() {
  memset(&cfg, 0, sizeof(cfg));
  strlcpy(cfg.wifiSsid,       SECRET_WIFI_SSID,     sizeof(cfg.wifiSsid));
  strlcpy(cfg.wifiPassword,   SECRET_WIFI_PASSWORD, sizeof(cfg.wifiPassword));
  strlcpy(cfg.mqttHost,       SECRET_MQTT_HOST,     sizeof(cfg.mqttHost));
  cfg.mqttPort = SECRET_MQTT_PORT;
  strlcpy(cfg.mqttUser,       SECRET_MQTT_USERNAME, sizeof(cfg.mqttUser));
  strlcpy(cfg.mqttPassword,   SECRET_MQTT_PASSWORD, sizeof(cfg.mqttPassword));
  cfg.mqttTopic[0] = '\0';   // empty = use default template at runtime
  cfg.mqttTls = false;
  cfg.mqttCaCert[0] = '\0';  // empty = setInsecure (encryption without cert check)
  strlcpy(cfg.siteCode,       "SITE-001",  sizeof(cfg.siteCode));
  strlcpy(cfg.boardCode,      "BOARD-001", sizeof(cfg.boardCode));
  strlcpy(cfg.sensorPzemCode, "PZEM-001",  sizeof(cfg.sensorPzemCode));
  strlcpy(cfg.sensorKwsCode,  "KWS-001",   sizeof(cfg.sensorKwsCode));
  cfg.kwsSlaveAddr = 2;
  strlcpy(cfg.ipMode, "dhcp", sizeof(cfg.ipMode));
  cfg.staticIp[0]      = '\0';
  cfg.staticGateway[0] = '\0';
  cfg.staticSubnet[0]  = '\0';
  cfg.staticDns[0]     = '\0';
  strlcpy(cfg.configUser,     "dragon", sizeof(cfg.configUser));
  strlcpy(cfg.configPassword, "dragon", sizeof(cfg.configPassword));
  cfg.requireLogin = true;     // lock the normal-mode web UI by default
  cfg.magic = CONFIG_MAGIC;
}

void loadConfig() {
  gPrefs.begin("led-monitor", true);            // read-only
  size_t got = gPrefs.getBytesLength("cfg");
  if (got == sizeof(cfg)) {
    gPrefs.getBytes("cfg", &cfg, sizeof(cfg));
  }
  gPrefs.end();
  if (got != sizeof(cfg) || cfg.magic != CONFIG_MAGIC) {
    Serial.println("Config: first boot or schema bump - applying defaults");
    applyDefaults();
    saveConfig();
  } else {
    Serial.printf("Config: loaded board=%s site=%s mqtt=%s:%u\n",
                  cfg.boardCode, cfg.siteCode, cfg.mqttHost, cfg.mqttPort);
  }
}

void saveConfig() {
  cfg.magic = CONFIG_MAGIC;
  gPrefs.begin("led-monitor", false);
  gPrefs.putBytes("cfg", &cfg, sizeof(cfg));
  gPrefs.end();
}

void factoryResetConfig() {
  applyDefaults();
  saveConfig();
  Serial.println("Config: factory reset complete");
}

// ─── Boot button detection ─────────────────────────────────────────
bool bootButtonHeldAtStartup() {
  pinMode(0, INPUT_PULLUP);
  delay(20);
  if (digitalRead(0) != LOW) return false;
  uint32_t start = millis();
  while (digitalRead(0) == LOW) {
    if (millis() - start >= 3000) {
      Serial.println("Boot: BOOT button held 3s — entering config portal");
      return true;
    }
    delay(50);
  }
  return false;
}

// ─── Config portal HTML ─────────────────────────────────────────────
static const char* PORTAL_HTML PROGMEM = R"HTML(<!doctype html>
<html lang="th"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Settings — %BOARD%</title>
<style>
*,*::before,*::after{box-sizing:border-box}
body{font-family:system-ui,Segoe UI,sans-serif;background:#0a0e1a;color:#f1f5f9;margin:0;padding:0;min-height:100vh}
.wrap{max-width:880px;margin:0 auto;padding:18px 18px 90px}
.topbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid #1e2938}
.back{color:#94a3b8;text-decoration:none;font-size:13px;display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border-radius:8px;background:#111729;border:1px solid #1e2938;transition:.15s}
.back:hover{color:#22d3ee;border-color:#22d3ee}
h1{font-size:20px;margin:0;color:#22d3ee}
.sub{font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-top:2px}
.grid{display:grid;grid-template-columns:1fr;gap:14px}
@media(min-width:760px){.grid{grid-template-columns:1fr 1fr}.grid .span-2{grid-column:span 2}}
.section{background:#111729;border:1px solid #1e2938;border-radius:12px;padding:16px}
.section h2{font-size:12px;margin:0 0 12px;color:#22d3ee;text-transform:uppercase;letter-spacing:.06em;display:flex;align-items:center;gap:8px}
.section h2::before{content:'';width:6px;height:6px;border-radius:50%;background:#22d3ee;box-shadow:0 0 8px #22d3ee}
label{display:block;font-size:11px;color:#94a3b8;margin:10px 0 5px;text-transform:uppercase;letter-spacing:.04em}
label.first{margin-top:0}
input,select{width:100%;background:#0a0e1a;border:1px solid #1e2938;border-radius:8px;padding:10px 12px;color:#f1f5f9;font-family:inherit;font-size:14px;transition:.15s}
input:focus,select:focus{outline:none;border-color:#22d3ee;box-shadow:0 0 0 3px rgba(34,211,238,.15)}
input:disabled{opacity:.4;cursor:not-allowed}
.pw{position:relative}
.pw input{padding-right:54px}
.pw .eye{position:absolute;right:6px;top:50%;transform:translateY(-50%);background:transparent;border:none;color:#64748b;cursor:pointer;padding:6px 10px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;border-radius:6px;flex:0 0 auto;width:auto;margin:0}
.pw .eye:hover{color:#22d3ee;background:rgba(34,211,238,.08)}
.row{display:flex;gap:10px}
.row>div{flex:1;min-width:0}
.toggle{display:flex;align-items:center;gap:10px;padding:10px;background:#0a0e1a;border:1px solid #1e2938;border-radius:8px;margin-top:8px;cursor:pointer}
.toggle input{width:auto;margin:0}
.hint{font-size:11px;color:#64748b;margin-top:6px;line-height:1.5}
.actions{position:sticky;bottom:0;background:linear-gradient(to top,#0a0e1a 60%,transparent);padding-top:16px;margin-top:18px;display:flex;gap:8px;flex-wrap:wrap}
button{background:#06b6d4;color:#fff;border:none;padding:12px 18px;border-radius:10px;font-weight:700;font-size:14px;cursor:pointer;font-family:inherit;flex:1;transition:.15s}
button:hover{background:#0891b2}
button.danger{background:#ef4444}
button.danger:hover{background:#dc2626}
button.ghost{background:#1e2938;color:#cbd5e1;flex:0 0 auto}
button.ghost:hover{background:#2a3850}
.msg{padding:14px;border-radius:10px;margin-bottom:14px;font-size:13px;display:flex;align-items:center;gap:12px}
.msg.ok{background:rgba(34,197,94,.1);color:#22c55e;border:1px solid rgba(34,197,94,.3)}
.msg.err{background:rgba(239,68,68,.1);color:#ef4444;border:1px solid rgba(239,68,68,.3)}
.spinner{width:18px;height:18px;border:2px solid rgba(34,211,238,.25);border-top-color:#22d3ee;border-radius:50%;animation:spin .8s linear infinite;flex-shrink:0}
@keyframes spin{to{transform:rotate(360deg)}}
.overlay{position:fixed;inset:0;background:rgba(10,14,26,.92);backdrop-filter:blur(6px);display:none;align-items:center;justify-content:center;z-index:100}
.overlay.show{display:flex}
.overlay-card{background:#111729;border:1px solid #1e2938;border-radius:14px;padding:32px;text-align:center;max-width:380px;width:90%}
.overlay-spinner{width:48px;height:48px;border:3px solid rgba(34,211,238,.2);border-top-color:#22d3ee;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 18px}
.overlay h3{margin:0 0 6px;color:#f1f5f9;font-size:16px}
.overlay p{margin:0;color:#94a3b8;font-size:13px;line-height:1.6}
.overlay .countdown{color:#22d3ee;font-variant-numeric:tabular-nums;font-weight:700}
</style></head><body>
<div class="wrap">
<div class="topbar">
  <a href="/" class="back">&larr; Back to dashboard</a>
  <div style="text-align:right">
    <h1>Settings</h1>
    <div class="sub">%BOARD% &middot; FW %FW% &middot; MAC %MAC%</div>
    <div class="sub" style="margin-top:2px">%ACCESS_HINT%</div>
  </div>
</div>
<div id="msg" style="display:none"></div>
<form id="f">
  <div class="grid">
    <div class="section span-2"><h2>Identity</h2>
      <div class="row">
        <div><label class="first">Site code</label><input name="siteCode" value="%SITE%" maxlength="23"></div>
        <div><label class="first">Board code</label><input name="boardCode" value="%BOARD%" maxlength="23"></div>
      </div>
      <div class="row">
        <div><label>PZEM sensor code</label><input name="sensorPzemCode" value="%PZEM_CODE%" maxlength="23"></div>
        <div><label>KWS sensor code</label><input name="sensorKwsCode" value="%KWS_CODE%" maxlength="23"></div>
      </div>
    </div>
    <div class="section"><h2>WiFi &amp; Network</h2>
      <label class="first">SSID</label><input name="wifiSsid" value="%WIFI_SSID%" maxlength="32">
      <label>Password</label>
      <div class="pw"><input name="wifiPassword" type="password" value="%WIFI_PASSWORD%" maxlength="64"><button type="button" class="eye" onclick="togglePw(this)">show</button></div>
      <div class="hint">Used when Ethernet is unavailable.</div>
      <label style="margin-top:14px">IP assignment</label>
      <select name="ipMode" id="ipMode">
        <option value="dhcp" %DHCP_SEL%>DHCP (automatic)</option>
        <option value="static" %STATIC_SEL%>Static IP</option>
      </select>
      <div id="staticFields" style="display:none">
        <div class="row" style="margin-top:8px">
          <div><label class="first">IP address</label><input name="staticIp" value="%STATIC_IP%" placeholder="10.88.1.178" maxlength="15"></div>
          <div><label class="first">Subnet mask</label><input name="staticSubnet" value="%STATIC_SUBNET%" placeholder="255.255.255.0" maxlength="15"></div>
        </div>
        <div class="row">
          <div><label>Gateway</label><input name="staticGateway" value="%STATIC_GATEWAY%" placeholder="10.88.1.1" maxlength="15"></div>
          <div><label>DNS server</label><input name="staticDns" value="%STATIC_DNS%" placeholder="8.8.8.8" maxlength="15"></div>
        </div>
      </div>
      <div class="hint" style="margin-top:6px">Current IP: <span style="color:#22d3ee">%CURRENT_IP%</span></div>
    </div>
    <div class="section"><h2>MQTT Broker</h2>
      <label class="first">Host</label><input name="mqttHost" value="%MQTT_HOST%" maxlength="63">
      <div class="row">
        <div><label>Port</label><input name="mqttPort" type="number" value="%MQTT_PORT%" min="1" max="65535"></div>
        <div><label>Slave addr (KWS)</label><input name="kwsSlaveAddr" type="number" value="%KWS_SLAVE%" min="1" max="247"></div>
      </div>
      <label>Username (optional)</label><input name="mqttUser" value="%MQTT_USER%" maxlength="32">
      <label>Password (optional)</label>
      <div class="pw"><input name="mqttPassword" type="password" value="%MQTT_PASS%" maxlength="64"><button type="button" class="eye" onclick="togglePw(this)">show</button></div>
      <label>Topic (blank = default)</label>
      <input name="mqttTopic" value="%MQTT_TOPIC%" placeholder="%MQTT_TOPIC_DEFAULT%" maxlength="159">
      <div class="hint">Leave blank to use <code style="color:#22d3ee">%MQTT_TOPIC_DEFAULT%</code> (auto-rebuilt from Site/Board codes).</div>
      <label class="toggle" style="margin-top:14px">
        <input type="checkbox" name="mqttTls" id="mqttTls" value="1" %MQTT_TLS_CHECKED%>
        <span>Use TLS (MQTTS) — secure encrypted connection, typically port 8883</span>
      </label>
      <div id="tlsCertBlock" style="display:none;margin-top:8px">
        <label>CA certificate (PEM, optional)</label>
        <textarea name="mqttCaCert" rows="6" placeholder="-----BEGIN CERTIFICATE-----&#10;MIID...&#10;-----END CERTIFICATE-----" style="width:100%;background:#0a0e1a;border:1px solid #1e2938;border-radius:8px;padding:10px 12px;color:#f1f5f9;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;line-height:1.4;resize:vertical">%MQTT_CA_CERT%</textarea>
        <div class="hint">Blank = encrypt only, skip server cert verification (fine for trusted local brokers). Paste broker's CA cert to verify chain (recommended for cloud brokers).</div>
      </div>
    </div>
    <div class="section span-2"><h2>Login &amp; Security</h2>
      <div class="row">
        <div><label class="first">Username</label><input name="configUser" value="%CFG_USER%" maxlength="23"></div>
        <div><label class="first">New password (blank = keep)</label>
          <div class="pw"><input name="configPassword" type="password" placeholder="••••••" maxlength="32"><button type="button" class="eye" onclick="togglePw(this)">show</button></div>
        </div>
      </div>
      <label class="toggle">
        <input type="checkbox" name="requireLogin" value="1" %CFG_REQUIRE_LOGIN%>
        <span>Require login for normal-mode web UI</span>
      </label>
    </div>
  </div>
  <div class="actions">
    <button type="submit">Save &amp; Reboot</button>
    <button type="button" class="ghost" onclick="rebootWithOverlay('Reboot without saving?','Restarting board...','Reconnecting after reboot.','%REBOOT_URL%')">Reboot</button>
    <button type="button" class="danger" onclick="rebootWithOverlay('Factory reset — wipe ALL settings?','Restoring defaults...','Board will boot fresh.','%RESET_URL%')">Factory Reset</button>
  </div>
</form>
</div>

<div id="overlay" class="overlay">
  <div class="overlay-card">
    <div class="overlay-spinner"></div>
    <h3 id="ovTitle">Saving configuration...</h3>
    <p id="ovDetail">Device will restart shortly.</p>
    <p id="ovCountLine" style="margin-top:14px">Redirecting in <span class="countdown" id="ovCount">15</span>s</p>
  </div>
</div>

<script>
// Show/hide for password inputs. Sits next to the input in a .pw wrapper.
function togglePw(btn){
  const inp=btn.previousElementSibling;
  if(inp.type==='password'){inp.type='text';btn.textContent='hide'}
  else{inp.type='password';btn.textContent='show'}
}

// Toggle visibility of the static IP block based on the IP-mode dropdown.
const ipModeSel=document.getElementById('ipMode');
const staticFields=document.getElementById('staticFields');
function syncIpMode(){staticFields.style.display=ipModeSel.value==='static'?'block':'none'}
ipModeSel.addEventListener('change',syncIpMode);syncIpMode();

// Show the CA cert textarea only when TLS is enabled. When the user first
// flips TLS on we also default the port to 8883 (the registered MQTTS port)
// if they were still on a plaintext port.
const tlsCb=document.getElementById('mqttTls');
const tlsBlock=document.getElementById('tlsCertBlock');
const portInp=document.querySelector('input[name="mqttPort"]');
function syncTls(){tlsBlock.style.display=tlsCb.checked?'block':'none'}
tlsCb.addEventListener('change',()=>{
  syncTls();
  if(tlsCb.checked && (portInp.value==='1883'||portInp.value==='11883')) portInp.value='8883';
  if(!tlsCb.checked && portInp.value==='8883') portInp.value='1883';
});
syncTls();

// Full-screen overlay + countdown then redirect. Shared by the save handler,
// the bare Reboot button and the Factory Reset button so they all give the
// same "the device is restarting, hang on a sec" feedback.
function showOverlayCountdown(title, detail, targetUrl){
  document.getElementById('ovTitle').textContent  = title;
  document.getElementById('ovDetail').textContent = detail;
  const cdLine=document.getElementById('ovCountLine');
  if(cdLine)cdLine.style.display='';
  document.getElementById('overlay').classList.add('show');
  let secs=12;
  const tick=()=>{
    const el=document.getElementById('ovCount');
    if(secs<=0){location.href=targetUrl;return}
    el.textContent=secs;secs--;setTimeout(tick,1000);
  };
  tick();
}

// Overlay without countdown — used when we know we can't reach the device
// from the current network (portal-AP → main-WiFi handoff).
function showOverlayMessage(title, detailHtml){
  document.getElementById('ovTitle').textContent  = title;
  document.getElementById('ovDetail').innerHTML   = detailHtml;
  const cdLine=document.getElementById('ovCountLine');
  if(cdLine)cdLine.style.display='none';
  document.getElementById('overlay').classList.add('show');
}

function onPortalAp(){return /^192\.168\.4\./.test(location.hostname)}

// Confirm → fire POST → show overlay → redirect when countdown ends.
// Special-cased for portal mode: AP goes away on reboot, so we can't redirect
// back to ourselves — show a "please reconnect" message instead.
function rebootWithOverlay(confirmMsg, title, detail, url){
  if(!confirm(confirmMsg))return;
  fetch(url,{method:'POST'}).catch(()=>{/* expected: socket dies on reboot */});
  if(onPortalAp()){
    showOverlayMessage(title,
      detail+'<br><br>Reconnect this device to your normal WiFi to find the board again.');
  } else {
    showOverlayCountdown(title, detail, '/');
  }
}

document.getElementById('f').addEventListener('submit',async e=>{
  e.preventDefault();
  const data=Object.fromEntries(new FormData(e.target));
  data.requireLogin = data.requireLogin === '1';
  data.mqttTls = data.mqttTls === '1';
  const msg=document.getElementById('msg');
  msg.style.display='flex';msg.className='msg';msg.innerHTML='<div class="spinner"></div><span>Saving configuration...</span>';
  try{
    const r=await fetch('%SAVE_URL%',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
    if(!r.ok){throw new Error(await r.text())}
    const isStatic = data.ipMode==='static' && data.staticIp;
    if(onPortalAp()){
      // Coming out of portal AP — board will rejoin the main WiFi, this device
      // will not. Give the operator a clickable target instead of redirecting
      // into the void.
      const board = (data.boardCode||'board').toLowerCase();
      const ssid  = data.wifiSsid||'your WiFi';
      const target = isStatic ? data.staticIp : (board+'.local');
      showOverlayMessage('Configuration saved',
        'Board is rebooting and will join <strong>'+ssid+'</strong>.<br><br>'+
        'Reconnect this device to that network, then open:<br>'+
        '<a href="http://'+target+'/" style="color:#22d3ee;font-weight:700;font-family:ui-monospace,SFMono-Regular,Menlo,monospace">http://'+target+'/</a>');
    } else {
      const targetHost = isStatic ? data.staticIp : location.hostname;
      const targetUrl  = location.protocol+'//'+targetHost+'/';
      showOverlayCountdown('Saving configuration...', 'Device will restart shortly.', targetUrl);
    }
  }catch(err){
    msg.className='msg err';msg.innerHTML='Error: '+err.message;
  }
});
</script></body></html>)HTML";

// mDNS hostname used in both portal mode AND normal mode so the technician
// can reach the board without knowing its DHCP-assigned IP. Format:
// "DGH-Monitor-XXXX" (last 16 bits of MAC, uppercase hex), reachable as
// <hostname>.local on any mDNS-aware OS. Not static so pzem_mqtt.ino's
// setup() can call it as well via Arduino's cross-file auto-prototype.
String mdnsHostname() {
  char host[24];
  uint32_t mac = (uint32_t)ESP.getEfuseMac();
  snprintf(host, sizeof(host), "DGH-Monitor-%04X", (uint16_t)(mac & 0xFFFF));
  return String(host);
}

// Renders an HTML line shown in the portal header when LAN access is live.
// Lets the operator copy the LAN IP / mDNS URL straight off the screen
// instead of fishing through a DHCP table or serial log.
static String portalAccessHint() {
  if (!g_ethHasIp) return String("");
  String host = mdnsHostname();
  String ip   = ETH.localIP().toString();
  // Show both the IP and the mDNS URL. mDNS is the friendlier option, but
  // it fails on some Android phones and corporate-locked Windows — the IP
  // is the always-works fallback.
  String h;
  h += "LAN: <a href=\"http://" + ip + "/\" style=\"color:#22d3ee\">" + ip + "</a>";
  h += " &middot; ";
  h += "<a href=\"http://" + host + ".local/\" style=\"color:#22d3ee\">" + host + ".local</a>";
  return h;
}

// Replace each %FOO% placeholder with the current cfg value (HTML-escaped).
static String htmlEscape(const char* s) {
  String out;
  for (size_t i = 0; s[i]; ++i) {
    char c = s[i];
    switch (c) {
      case '&':  out += "&amp;"; break;
      case '<':  out += "&lt;"; break;
      case '>':  out += "&gt;"; break;
      case '"':  out += "&quot;"; break;
      case '\'': out += "&#39;"; break;
      default:   out += c;
    }
  }
  return out;
}

String renderConfigForm(const char* saveUrl, const char* rebootUrl, const char* resetUrl) {
  String html = FPSTR(PORTAL_HTML);
  char mac[18];
  uint64_t m = ESP.getEfuseMac();
  snprintf(mac, sizeof(mac), "%02X:%02X:%02X:%02X:%02X:%02X",
           (uint8_t)(m>>40), (uint8_t)(m>>32), (uint8_t)(m>>24),
           (uint8_t)(m>>16), (uint8_t)(m>>8),  (uint8_t)m);
  html.replace("%MAC%",            mac);
  html.replace("%FW%",             FIRMWARE_VERSION);
  // Tiny one-liner that tells the technician how they can reach this same
  // page from their LAN if WiFi softAP isn't usable. Filled by the portal
  // setup *after* ETH gets an IP; in normal mode it's left blank because
  // /settings is only opened after the operator already knows the IP.
  html.replace("%ACCESS_HINT%",    portalAccessHint());
  html.replace("%WIFI_SSID%",      htmlEscape(cfg.wifiSsid));
  html.replace("%WIFI_PASSWORD%",  htmlEscape(cfg.wifiPassword));
  html.replace("%MQTT_HOST%",      htmlEscape(cfg.mqttHost));
  html.replace("%MQTT_PORT%",      String(cfg.mqttPort));
  html.replace("%MQTT_USER%",      htmlEscape(cfg.mqttUser));
  html.replace("%MQTT_PASS%",      htmlEscape(cfg.mqttPassword));
  html.replace("%MQTT_TOPIC%",     htmlEscape(cfg.mqttTopic));
  char topicDefault[180];
  snprintf(topicDefault, sizeof(topicDefault),
           "sites/%s/boards/%s/telemetry", cfg.siteCode, cfg.boardCode);
  html.replace("%MQTT_TOPIC_DEFAULT%", htmlEscape(topicDefault));
  html.replace("%MQTT_TLS_CHECKED%", cfg.mqttTls ? "checked" : "");
  html.replace("%MQTT_CA_CERT%",   htmlEscape(cfg.mqttCaCert));
  html.replace("%SITE%",           htmlEscape(cfg.siteCode));
  html.replace("%BOARD%",          htmlEscape(cfg.boardCode));
  html.replace("%PZEM_CODE%",      htmlEscape(cfg.sensorPzemCode));
  html.replace("%KWS_CODE%",       htmlEscape(cfg.sensorKwsCode));
  html.replace("%KWS_SLAVE%",      String(cfg.kwsSlaveAddr));
  bool isStatic = strcmp(cfg.ipMode, "static") == 0;
  html.replace("%DHCP_SEL%",       isStatic ? "" : "selected");
  html.replace("%STATIC_SEL%",     isStatic ? "selected" : "");
  html.replace("%STATIC_IP%",      htmlEscape(cfg.staticIp));
  html.replace("%STATIC_SUBNET%",  htmlEscape(cfg.staticSubnet));
  html.replace("%STATIC_GATEWAY%", htmlEscape(cfg.staticGateway));
  html.replace("%STATIC_DNS%",     htmlEscape(cfg.staticDns));
  html.replace("%CURRENT_IP%",     activeLocalIp().toString());
  html.replace("%CFG_USER%",       htmlEscape(cfg.configUser));
  html.replace("%CFG_REQUIRE_LOGIN%", cfg.requireLogin ? "checked" : "");
  html.replace("%SAVE_URL%",       saveUrl);
  html.replace("%REBOOT_URL%",     rebootUrl);
  html.replace("%RESET_URL%",      resetUrl);
  return html;
}

// ─── Portal web server ──────────────────────────────────────────────
static DNSServer  portalDns;
static WebServer  portalWeb(80);

static bool authed(WebServer& s) {
  if (!s.authenticate(cfg.configUser, cfg.configPassword)) {
    s.requestAuthentication(BASIC_AUTH, "LED Wall Monitor Setup",
                            "Please log in with the admin credentials.");
    return false;
  }
  return true;
}

static void handleRoot() {
  if (!authed(portalWeb)) return;
  portalWeb.send(200, "text/html; charset=utf-8",
                 renderConfigForm("/save", "/reboot", "/factory-reset"));
}

static void copyField(JsonDocument& doc, const char* key, char* dest, size_t n) {
  if (!doc.containsKey(key)) return;
  const char* v = doc[key].as<const char*>();
  if (v) strlcpy(dest, v, n);
}

bool applyConfigFromJson(const char* json, String& err) {
  // 4 KB is enough for every text field plus an optional 2 KB PEM CA cert.
  DynamicJsonDocument doc(4096);
  DeserializationError jerr = deserializeJson(doc, json);
  if (jerr) {
    err = String("bad json: ") + jerr.c_str();
    return false;
  }
  copyField(doc, "wifiSsid",       cfg.wifiSsid,       sizeof(cfg.wifiSsid));
  copyField(doc, "wifiPassword",   cfg.wifiPassword,   sizeof(cfg.wifiPassword));
  copyField(doc, "mqttHost",       cfg.mqttHost,       sizeof(cfg.mqttHost));
  if (doc.containsKey("mqttPort")) cfg.mqttPort = doc["mqttPort"].as<uint16_t>();
  copyField(doc, "mqttUser",       cfg.mqttUser,       sizeof(cfg.mqttUser));
  copyField(doc, "mqttPassword",   cfg.mqttPassword,   sizeof(cfg.mqttPassword));
  copyField(doc, "mqttTopic",      cfg.mqttTopic,      sizeof(cfg.mqttTopic));
  if (doc.containsKey("mqttTls"))  cfg.mqttTls = doc["mqttTls"].as<bool>();
  copyField(doc, "mqttCaCert",     cfg.mqttCaCert,     sizeof(cfg.mqttCaCert));
  copyField(doc, "siteCode",       cfg.siteCode,       sizeof(cfg.siteCode));
  copyField(doc, "boardCode",      cfg.boardCode,      sizeof(cfg.boardCode));
  copyField(doc, "sensorPzemCode", cfg.sensorPzemCode, sizeof(cfg.sensorPzemCode));
  copyField(doc, "sensorKwsCode",  cfg.sensorKwsCode,  sizeof(cfg.sensorKwsCode));
  if (doc.containsKey("kwsSlaveAddr")) cfg.kwsSlaveAddr = doc["kwsSlaveAddr"].as<uint8_t>();
  copyField(doc, "ipMode",         cfg.ipMode,         sizeof(cfg.ipMode));
  copyField(doc, "staticIp",       cfg.staticIp,       sizeof(cfg.staticIp));
  copyField(doc, "staticGateway",  cfg.staticGateway,  sizeof(cfg.staticGateway));
  copyField(doc, "staticSubnet",   cfg.staticSubnet,   sizeof(cfg.staticSubnet));
  copyField(doc, "staticDns",      cfg.staticDns,      sizeof(cfg.staticDns));
  copyField(doc, "configUser",     cfg.configUser,     sizeof(cfg.configUser));
  // Blank password input means "keep current" so the user can save other
  // fields without retyping every time.
  const char* pw = doc["configPassword"].as<const char*>();
  if (pw && pw[0] != '\0') strlcpy(cfg.configPassword, pw, sizeof(cfg.configPassword));
  if (doc.containsKey("requireLogin")) cfg.requireLogin = doc["requireLogin"].as<bool>();
  saveConfig();
  return true;
}

static void handleSave() {
  if (!authed(portalWeb)) return;
  String err;
  if (!applyConfigFromJson(portalWeb.arg("plain").c_str(), err)) {
    portalWeb.send(400, "text/plain", err);
    return;
  }
  portalWeb.send(200, "application/json", "{\"ok\":true}");
  Serial.println("Portal: saved — restarting in 2s");
  delay(2000);
  ESP.restart();
}

static void handleReboot() {
  if (!authed(portalWeb)) return;
  portalWeb.send(200, "text/plain", "rebooting");
  delay(300);
  ESP.restart();
}

static void handleFactoryReset() {
  if (!authed(portalWeb)) return;
  factoryResetConfig();
  portalWeb.send(200, "text/plain", "factory reset — rebooting");
  delay(300);
  ESP.restart();
}

// Captive-portal catch-all. The DNS wildcard resolves every hostname to our
// AP IP, so iOS/Android/Windows probes (captive.apple.com/hotspot-detect.html,
// connectivitycheck.gstatic.com/generate_204, msftconnecttest.com/connecttest,
// ...) all land here. Returning a 200 HTML page that is NOT the OS's expected
// "Success" / 204 response triggers the captive-portal popup — and the meta
// refresh inside pulls the popup to our setup form on 192.168.4.1.
static void handleCaptive() {
  portalWeb.sendHeader("Cache-Control", "no-store");
  static const char* CAPTIVE_HTML =
    "<!doctype html><html lang=\"en\"><head>"
    "<meta charset=\"utf-8\">"
    "<meta http-equiv=\"refresh\" content=\"0;url=http://192.168.4.1/\">"
    "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
    "<title>LED Wall Monitor Setup</title>"
    "<style>body{font-family:system-ui,Segoe UI,sans-serif;background:#0a0e1a;color:#f1f5f9;"
    "display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:24px}"
    ".card{background:#111729;border:1px solid #1e2938;border-radius:14px;padding:32px;max-width:360px}"
    "h1{color:#22d3ee;font-size:18px;margin:0 0 10px}"
    "p{color:#94a3b8;margin:0 0 16px;font-size:14px}"
    "a{color:#fff;background:#06b6d4;font-size:14px;padding:12px 24px;border-radius:10px;"
    "text-decoration:none;display:inline-block;font-weight:700}"
    ".sp{width:32px;height:32px;border:3px solid rgba(34,211,238,.25);border-top-color:#22d3ee;"
    "border-radius:50%;animation:s 1s linear infinite;margin:0 auto 16px}"
    "@keyframes s{to{transform:rotate(360deg)}}</style></head>"
    "<body><div class=\"card\"><div class=\"sp\"></div>"
    "<h1>LED Wall Monitor</h1>"
    "<p>Opening device setup&hellip;</p>"
    "<a href=\"http://192.168.4.1/\">Tap to open setup</a></div></body></html>";
  portalWeb.send(200, "text/html; charset=utf-8", CAPTIVE_HTML);
}

void runConfigPortal() {
  Serial.println("=== CONFIG PORTAL ===");

  // Entering the portal is the documented recovery path, so reset the local
  // admin credentials to admin/admin every time. If the operator wanted a
  // custom password they can re-set it before leaving the portal.
  strlcpy(cfg.configUser,     "dragon", sizeof(cfg.configUser));
  strlcpy(cfg.configPassword, "dragon", sizeof(cfg.configPassword));
  saveConfig();
  Serial.println("Portal: configUser/configPassword reset to dragon/dragon");

  // Disable any task subscriptions to the WDT before we block in the portal —
  // the user may take minutes typing in their WiFi password and we don't want
  // the watchdog rebooting them mid-form.
  esp_task_wdt_delete(NULL);

  char apSsid[32];
  uint32_t mac = (uint32_t)ESP.getEfuseMac();
  snprintf(apSsid, sizeof(apSsid), "DGH-Monitor-%04X", (uint16_t)(mac & 0xFFFF));

  // Both interfaces come up in parallel so the technician can reach the
  // portal whether the site only has WiFi tethering or only has a wired
  // LAN drop. The same WebServer instance listens on every interface, so
  // there's no extra HTTP server to manage.
  Network.onEvent(onNetworkEvent);

  WiFi.mode(WIFI_AP);
  WiFi.softAP(apSsid, "012345678");
  delay(200);
  IPAddress apIp = WiFi.softAPIP();
  Serial.printf("Portal AP: SSID=%s  pass=012345678\n", apSsid);
  Serial.printf("Portal URL (WiFi): http://%s/\n", apIp.toString().c_str());
  Serial.printf("Login: %s / %s\n", cfg.configUser, cfg.configPassword);

  // Ethernet: bring up the LAN8720 PHY with the HKL-EA8 pinout and wait
  // briefly for DHCP. If no cable / no DHCP server, we just drop through —
  // the AP path still works.
  Serial.println("Portal ETH: begin");
  if (!ETH.begin(ETH_PHY_TYPE_HKL, ETH_PHY_ADDR_HKL, ETH_PHY_MDC_HKL,
                 ETH_PHY_MDIO_HKL, ETH_PHY_POWER_HKL, ETH_CLK_MODE_HKL)) {
    Serial.println("Portal ETH: begin() failed — WiFi-only portal");
  } else {
    uint32_t ethWaitStart = millis();
    while (!g_ethHasIp && millis() - ethWaitStart < 4000) {
      delay(100);
    }
    if (g_ethHasIp) {
      Serial.printf("Portal URL (LAN):  http://%s/\n",
                    ETH.localIP().toString().c_str());
    } else {
      Serial.println("Portal ETH: no IP within 4s (no cable or no DHCP)");
    }
  }
  IPAddress ip = apIp;  // captive-portal DNS still anchored to the WiFi side

  // mDNS responder so the technician can reach the portal page without
  // needing to know the LAN IP. Works on both the WiFi AP side
  // (DGH-Monitor-XXXX.local resolves to 192.168.4.1) and the ETH side
  // (resolves to the DHCP IP) — whichever interface the operator's device
  // is on, the same hostname works.
  String host = mdnsHostname();
  if (MDNS.begin(host.c_str())) {
    MDNS.addService("http", "tcp", 80);
    Serial.printf("Portal mDNS:  http://%s.local/\n", host.c_str());
  } else {
    Serial.println("Portal mDNS: begin() failed");
  }

  // Captive-portal DNS: every name resolves to us.
  portalDns.setErrorReplyCode(DNSReplyCode::NoError);
  portalDns.start(53, "*", ip);

  portalWeb.on("/", HTTP_GET, handleRoot);
  portalWeb.on("/save", HTTP_POST, handleSave);
  portalWeb.on("/reboot", HTTP_POST, handleReboot);
  portalWeb.on("/factory-reset", HTTP_POST, handleFactoryReset);
  // Common captive-portal probe URLs from various OSes — answering "no
  // internet" makes the OS pop up the login page automatically.
  portalWeb.onNotFound(handleCaptive);
  portalWeb.begin();

  // Audible "portal ready" — one long beep so the operator can distinguish
  // it from the normal-mode boot pattern (two short beeps).
  beep(500);

  // Heartbeat pattern (short + long) every ~15 s so anyone walking past the
  // device can tell at a glance that it's sitting in setup mode rather than
  // operating normally.
  const uint32_t HEARTBEAT_MS = 15000;
  uint32_t lastHeartbeat = millis();

  for (;;) {
    portalDns.processNextRequest();
    portalWeb.handleClient();

    if (millis() - lastHeartbeat >= HEARTBEAT_MS) {
      lastHeartbeat = millis();
      beep(80);
      delay(150);
      beep(500);
      delay(150);
      beep(80);
    }

    delay(10);
  }
}
