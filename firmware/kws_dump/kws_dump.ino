/*
 * KWS-AC301L raw register dumper
 *
 * Reads registers 0x0000-0x0013 as Holding Registers (function 0x03)
 * from slave address 2 at 9600 baud and prints them every 3 seconds.
 *
 * Helpful for identifying which register holds which value (V, A, W, etc.)
 * by watching values change when a load is applied/removed.
 */

#include <ModbusMaster.h>

#define RS485_RX 14
#define RS485_TX 13
#define KWS_ADDR 2
#define KWS_BAUD 9600
#define READ_COUNT 8    // read 8 regs = 0x0000-0x0007

ModbusMaster kws;

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println();
  Serial.println("=== KWS Raw Register Dump ===");
  Serial.printf("Slave=%u  Baud=%lu  Function=0x03 (Holding)\n", KWS_ADDR, (long)KWS_BAUD);

  Serial2.begin(KWS_BAUD, SERIAL_8N1, RS485_RX, RS485_TX);
  kws.begin(KWS_ADDR, Serial2);
  delay(100);
}

void dumpRange(uint16_t start, uint8_t count) {
  Serial.printf("\n-- range 0x%04X (count=%u) --\n", start, count);
  uint8_t result = kws.readHoldingRegisters(start, count);
  if (result != kws.ku8MBSuccess) {
    Serial.printf("  ERROR 0x%02X\n", result);
    return;
  }
  for (int i = 0; i < count; i++) {
    uint16_t v = kws.getResponseBuffer(i);
    Serial.printf("  reg 0x%04X = 0x%04X  (%5u  /10=%.1f  /100=%.2f  /1000=%.3f)\n",
                  start + i, v, v, v / 10.0, v / 100.0, v / 1000.0);
  }
}

void loop() {
  dumpRange(0x0000, 8);   // header area
  dumpRange(0x000E, 8);   // V/A/W area per docs
  dumpRange(0x0017, 8);   // Energy / Temp / PF / Hz area per docs
  delay(5000);
}
