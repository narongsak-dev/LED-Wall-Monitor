#pragma once
#include <Arduino.h>

// Binary telemetry record stored in the LittleFS queue. Designed for
// efficient store-and-forward when MQTT is unavailable.
//
//   v1 layout = 64 bytes (PZEM + KWS aggregates)
//   v2 layout = 100 bytes (adds KWS per-phase: V_A/B/C, I_A/B/C, P_A/B/C)
//   24 h @ 3 s = 28,800 records = 2.75 MB at v2 — exceeds the 2 MB cap,
//   so the queue's oldest-eviction logic will trim the tail.
//
// On firmware upgrade the on-disk record size changes; tqBegin() detects
// this via the saved REC_SIZE in NVS and wipes the file rather than
// reading garbage.
struct __attribute__((packed)) TelemetryRecord {
  // Millisecond Unix timestamp (NTP-synced). 0 = invalid (no clock yet).
  uint64_t timeMs;
  // bit 0 = pzemOk, bit 1 = kwsOk
  uint8_t  flags;
  uint8_t  _pad[3];
  // PZEM (24 B)
  float pzemV, pzemI, pzemP, pzemE, pzemPF, pzemFreq;
  // KWS aggregates (28 B)
  float kwsV, kwsI, kwsP, kwsE, kwsPF, kwsFreq, kwsTemp;
  // KWS per-phase (36 B; zero on AC301L)
  float kwsVa, kwsVb, kwsVc;
  float kwsIa, kwsIb, kwsIc;
  float kwsPa, kwsPb, kwsPc;
};
static_assert(sizeof(TelemetryRecord) == 100, "TelemetryRecord size changed — bump version + handle migration");

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
