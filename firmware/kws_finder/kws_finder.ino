/*
 * KWS-AC301L Modbus finder
 *
 * Tries combinations of: baud rate, slave address, function code (0x03 vs 0x04).
 * RS485 is on Serial2 (GPIO RX=14, TX=13), auto-direction transceiver.
 *
 * Reports any combo that yields a valid Modbus response.
 */

#include <ModbusMaster.h>

#define RS485_RX 14
#define RS485_TX 13

const long BAUDS[]      = { 9600, 4800, 19200, 38400 };
const uint8_t ADDRS[]   = { 1, 2, 3, 247, 0xF8 };
const uint16_t START_REGS[] = { 0x0000, 0x0001, 0x0010, 0x0100 };

ModbusMaster modbus;
bool foundAny = false;

bool tryReadInput(uint8_t addr, uint16_t reg) {
  modbus.clearResponseBuffer();
  modbus.begin(addr, Serial2);
  uint8_t result = modbus.readInputRegisters(reg, 4);
  if (result == modbus.ku8MBSuccess) {
    Serial.printf(">>> 0x04 INPUT  addr=%u reg=0x%04X  raw=", addr, reg);
    for (int i = 0; i < 4; i++) Serial.printf("%04X ", modbus.getResponseBuffer(i));
    Serial.println();
    return true;
  }
  return false;
}

bool tryReadHolding(uint8_t addr, uint16_t reg) {
  modbus.clearResponseBuffer();
  modbus.begin(addr, Serial2);
  uint8_t result = modbus.readHoldingRegisters(reg, 4);
  if (result == modbus.ku8MBSuccess) {
    Serial.printf(">>> 0x03 HOLD   addr=%u reg=0x%04X  raw=", addr, reg);
    for (int i = 0; i < 4; i++) Serial.printf("%04X ", modbus.getResponseBuffer(i));
    Serial.println();
    return true;
  }
  return false;
}

void scanAtBaud(long baud) {
  Serial.printf("\n=== Baud %ld ===\n", baud);
  Serial.flush();

  Serial2.end();
  delay(50);
  Serial2.begin(baud, SERIAL_8N1, RS485_RX, RS485_TX);
  delay(100);

  for (uint8_t addr : ADDRS) {
    for (uint16_t reg : START_REGS) {
      if (tryReadInput(addr, reg))   foundAny = true;
      if (tryReadHolding(addr, reg)) foundAny = true;
    }
  }
}

void setup() {
  Serial.begin(115200);
  delay(800);
  Serial.println();
  Serial.println("=== KWS-AC301L Modbus Finder ===");
  Serial.println("RS485 on Serial2 (GPIO RX=14 TX=13), auto-direction.");
  Serial.flush();

  for (long b : BAUDS) scanAtBaud(b);

  Serial.printf("\n=== Done. %s ===\n",
                foundAny ? "Found at least one working combo!" : "Nothing responded.");
  if (!foundAny) {
    Serial.println("Likely causes:");
    Serial.println(" 1. RS485 A/B wires swapped at meter side");
    Serial.println(" 2. KWS not powered (L/N AC not connected)");
    Serial.println(" 3. Meter is not KWS-AC301L Modbus variant");
  }
}

void loop() { delay(5000); }
