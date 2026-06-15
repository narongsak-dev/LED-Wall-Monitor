// Store-and-forward queue for telemetry — survives MQTT broker outages.
//
// Persistence model:
//   - `/queue.bin` on LittleFS is an append-only log of fixed-size records.
//   - `readOffset` in NVS tracks how far we've drained into the file.
//   - When the file exceeds COMPACT_AT_BYTES AND part of it is already
//     drained, we rewrite the tail-only portion to keep on-disk size in
//     check. When the file hits MAX_BYTES we drop the oldest record to make
//     room for the new one (silent oldest-wins eviction).
//
// Wear:
//   - One flash write per buffered record (typically < 30 k/day) plus
//     coalesced NVS commits every ~100 drains. Well within the 100 k
//     erase-cycle budget for chip lifetime.

#include "queue.h"
#include <LittleFS.h>
#include <Preferences.h>

static const char* QUEUE_PATH      = "/queue.bin";
static const char* QUEUE_TMP_PATH  = "/queue.tmp";
static const size_t REC_SIZE          = sizeof(TelemetryRecord);
static const size_t MAX_BYTES         = 2 * 1024 * 1024;  // hard cap
static const size_t COMPACT_AT_BYTES  = static_cast<size_t>(1.5 * 1024 * 1024);
static const uint32_t PERSIST_EVERY   = 50;  // drain ticks between NVS writes

static Preferences   g_tqNvs;
static uint32_t      g_readOffset = 0;
static uint32_t      g_unpersisted = 0;

static void persistOffset(bool force = false) {
  if (!force && ++g_unpersisted < PERSIST_EVERY) return;
  g_unpersisted = 0;
  g_tqNvs.begin("tqueue", false);
  g_tqNvs.putUInt("readOff", g_readOffset);
  g_tqNvs.end();
}

size_t tqFileBytes() {
  File f = LittleFS.open(QUEUE_PATH, "r");
  if (!f) return 0;
  size_t s = f.size();
  f.close();
  return s;
}

uint32_t tqPending() {
  size_t total = tqFileBytes();
  if (g_readOffset >= total) return 0;
  return static_cast<uint32_t>((total - g_readOffset) / REC_SIZE);
}

// Drop the prefix that's already been drained — keeps file size bounded
// without losing any pending records.
static void compactIfNeeded() {
  size_t total = tqFileBytes();
  if (total < COMPACT_AT_BYTES) return;
  if (g_readOffset < REC_SIZE) return;  // nothing drained yet — can't shrink

  File src = LittleFS.open(QUEUE_PATH, "r");
  if (!src) return;
  if (!src.seek(g_readOffset)) { src.close(); return; }
  File dst = LittleFS.open(QUEUE_TMP_PATH, "w");
  if (!dst) { src.close(); return; }
  uint8_t buf[1024];
  while (src.available()) {
    int n = src.read(buf, sizeof(buf));
    if (n <= 0) break;
    dst.write(buf, n);
  }
  src.close();
  dst.close();
  LittleFS.remove(QUEUE_PATH);
  LittleFS.rename(QUEUE_TMP_PATH, QUEUE_PATH);
  Serial.printf("Queue: compacted (was %u B, now %u B)\n",
                (unsigned)total, (unsigned)tqFileBytes());
  g_readOffset = 0;
  persistOffset(true);
}

bool tqBegin() {
  if (!LittleFS.begin(true)) {
    Serial.println("LittleFS: mount failed");
    return false;
  }
  // Bump this whenever we change the on-disk record layout (struct
  // fields added/removed/reordered). Firmware that boots with a
  // saved generation different from this current value wipes the
  // file. Generations: 1 = pre-per-phase (64 B), 2 = with per-phase
  // KWS V/I/P (100 B).
  const uint32_t CURRENT_FMT_GEN = 2;

  g_tqNvs.begin("tqueue", true);
  g_readOffset = g_tqNvs.getUInt("readOff", 0);
  uint32_t savedFmtGen = g_tqNvs.getUInt("fmtGen", 0);
  g_tqNvs.end();
  // Wipe on ANY mismatch — including the first boot of a firmware
  // that has fmtGen set (savedFmtGen == 0). Previous incarnation of
  // this check (`saved != 0 && saved != REC_SIZE`) missed the very
  // first upgrade, so the old 64-byte records leaked into a 100-byte
  // reader and emitted garbage telemetry.
  if (savedFmtGen != CURRENT_FMT_GEN) {
    Serial.printf("Queue: format generation %u → %u — wiping file\n",
                  (unsigned)savedFmtGen, (unsigned)CURRENT_FMT_GEN);
    LittleFS.remove(QUEUE_PATH);
    g_readOffset = 0;
  }
  // Persist the current generation so future boots take the fast path.
  g_tqNvs.begin("tqueue", false);
  g_tqNvs.putUInt("fmtGen", CURRENT_FMT_GEN);
  g_tqNvs.putUInt("readOff", g_readOffset);
  g_tqNvs.end();
  Serial.printf("Queue: file=%u B fmtGen=%u readOff=%u pending=%u\n",
                (unsigned)tqFileBytes(), (unsigned)CURRENT_FMT_GEN,
                (unsigned)g_readOffset, (unsigned)tqPending());
  return true;
}

bool tqAppend(const TelemetryRecord& r) {
  size_t total = tqFileBytes();
  // Hard cap: drop oldest by bumping readOffset (no rewrite — compactIfNeeded
  // will reclaim later).
  if (total >= MAX_BYTES) {
    g_readOffset += REC_SIZE;
    if (g_readOffset > total) g_readOffset = total;
  }
  File f = LittleFS.open(QUEUE_PATH, "a");
  if (!f) {
    Serial.println("Queue: append open failed");
    return false;
  }
  size_t w = f.write(reinterpret_cast<const uint8_t*>(&r), REC_SIZE);
  f.close();
  if (w != REC_SIZE) {
    Serial.printf("Queue: short write %u/%u\n", (unsigned)w, (unsigned)REC_SIZE);
    return false;
  }
  compactIfNeeded();
  return true;
}

bool tqDrainOne(TelemetryRecord& out) {
  if (tqPending() == 0) return false;
  File f = LittleFS.open(QUEUE_PATH, "r");
  if (!f) return false;
  if (!f.seek(g_readOffset)) { f.close(); return false; }
  size_t n = f.read(reinterpret_cast<uint8_t*>(&out), REC_SIZE);
  f.close();
  if (n != REC_SIZE) return false;
  g_readOffset += REC_SIZE;
  persistOffset();
  return true;
}
