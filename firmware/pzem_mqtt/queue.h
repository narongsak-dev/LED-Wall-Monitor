#pragma once
#include <Arduino.h>

// Binary telemetry record stored in the LittleFS queue. Designed for
// efficient store-and-forward when MQTT is unavailable.
//
//   1 record = 64 bytes
//   24 h @ 3 s = 28,800 records = 1.84 MB → fits a 2 MB buffer comfortably.
struct __attribute__((packed)) TelemetryRecord {
  // Millisecond Unix timestamp (NTP-synced). 0 = invalid (no clock yet).
  uint64_t timeMs;
  // bit 0 = pzemOk, bit 1 = kwsOk
  uint8_t  flags;
  uint8_t  _pad[3];
  // PZEM (24 B)
  float pzemV, pzemI, pzemP, pzemE, pzemPF, pzemFreq;
  // KWS (28 B)
  float kwsV, kwsI, kwsP, kwsE, kwsPF, kwsFreq, kwsTemp;
};
static_assert(sizeof(TelemetryRecord) == 64, "TelemetryRecord must be 64 bytes");

// Mount LittleFS, open queue, restore read offset from NVS.
bool tqBegin();
// Append one record. Drops oldest if buffer is full. Returns true on success.
bool tqAppend(const TelemetryRecord& r);
// Read the next pending record + advance + persist offset.
// Returns false when queue is empty.
bool tqDrainOne(TelemetryRecord& out);
// Number of records waiting to be sent.
uint32_t tqPending();
// On-disk size of the queue file (bytes).
size_t tqFileBytes();
