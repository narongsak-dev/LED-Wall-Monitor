#pragma once
#include <Arduino.h>

// Persisted device configuration. Stored in NVS under the "led-monitor"
// namespace as a single binary blob. Bumping CONFIG_MAGIC will force every
// board to factory-reset on the next boot — use only for breaking changes
// to the struct layout.
struct Config {
  // WiFi credentials (fallback transport when Ethernet is unavailable).
  char wifiSsid[33];
  char wifiPassword[65];

  // MQTT broker.
  char     mqttHost[64];
  uint16_t mqttPort;
  char     mqttUser[33];
  char     mqttPassword[65];
  // Optional custom publish topic. When empty, the firmware composes the
  // default sites/<site>/boards/<board>/telemetry template instead.
  char     mqttTopic[160];
  // TLS / MQTTS support. When mqttTls is true and mqttCaCert is non-empty,
  // the broker certificate is verified against the supplied PEM CA cert.
  // When mqttTls is true and mqttCaCert is empty, the client encrypts the
  // session but skips certificate validation (setInsecure) — fine for trusted
  // local brokers, not safe for the public internet.
  bool     mqttTls;
  char     mqttCaCert[2048];

  // Identity / topic codes.
  char    siteCode[24];
  char    boardCode[24];
  char    sensorPzemCode[24];
  char    sensorKwsCode[24];
  uint8_t kwsSlaveAddr;
  // Phase wiring of the KWS meter. 1 = single-phase (KWS-AC301L, the
  // original supported model). 3 = three-phase (KWS-AC306L/306L,
  // different register map + scale + word order). New field appended
  // to the struct so existing NVS blobs still load — a value of 0
  // (uninitialised) is treated as 1-phase by the reader.
  uint8_t kwsPhases;

  // Network: DHCP (default) or static IP. Static applies to whichever
  // transport is active (Ethernet preferred, WiFi fallback).
  char ipMode[8];          // "dhcp" or "static"
  char staticIp[16];
  char staticGateway[16];
  char staticSubnet[16];
  char staticDns[16];

  // Local config-portal authentication (also used for the normal-mode web UI
  // when requireLogin is true).
  char configUser[24];
  char configPassword[33];
  bool requireLogin;

  // One-shot flag: set by /enter-config in normal mode, consumed by setup()
  // on the next boot to drop into the portal without losing existing config.
  bool wantsPortalOnNextBoot;

  // Magic number used to detect first boot / corrupted NVS.
  uint32_t magic;
};

extern Config cfg;
extern const uint32_t CONFIG_MAGIC;

// Load config from NVS. If absent or stale, apply factory defaults.
void loadConfig();
// Persist current cfg to NVS.
void saveConfig();
// Reset cfg to factory defaults (from secrets.h) and persist.
void factoryResetConfig();

// Returns true if BOOT (GPIO 0) is held LOW for ≥3 s during boot.
bool bootButtonHeldAtStartup();

// Enter the AP-mode config portal. Blocks until the user reboots from the UI
// (or a watchdog reset kicks in if they walk away).
void runConfigPortal();

// Shared config form (used by both the AP-mode portal and the normal-mode
// /settings page). The three URLs let the same HTML POST to whichever endpoint
// the calling page chose.
String renderConfigForm(const char* saveUrl, const char* rebootUrl, const char* resetUrl);

// Parse a config-form JSON body and apply it to cfg + persist to NVS.
// On error, returns false and fills `err` with a human-readable message.
bool applyConfigFromJson(const char* json, String& err);
