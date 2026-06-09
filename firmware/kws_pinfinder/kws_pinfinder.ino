/*
 * KWS-AC301L scanner via built-in RS485 (A/B terminals on HKL-EA8)
 *
 * Tries multiple combinations of:
 *   - UART (1 or 2)
 *   - RX/TX GPIO pins
 *   - DE/RE GPIO pin (or no DE - auto-direction transceiver)
 *   - Slave address (1, 2, 0xF8)
 *
 * For each combo: send Modbus RTU "Read Input Registers" at addr 0x0000
 * (KWS standard voltage register), wait for response, verify CRC + length.
 */

#include <ModbusMaster.h>

const long BAUD = 9600;

struct DECombo {
  const char* label;
  int dePin;     // -1 = no DE/RE control (auto transceiver)
};

struct UartCombo {
  const char* label;
  uint8_t uartNum;
  int rxPin;
  int txPin;
};

UartCombo uartCombos[] = {
  { "UART2 RX=16 TX=17", 2, 16, 17 },
  { "UART2 RX=17 TX=16", 2, 17, 16 },
  { "UART1 RX=13 TX=14", 1, 13, 14 },
  { "UART1 RX=14 TX=13", 1, 14, 13 },
  { "UART1 RX=32 TX=33", 1, 32, 33 },
  { "UART1 RX=33 TX=32", 1, 33, 32 },
};
const int UART_COUNT = sizeof(uartCombos) / sizeof(uartCombos[0]);

DECombo deCombos[] = {
  { "no-DE (auto)",   -1 },
  { "DE=4",            4 },
  { "DE=5",            5 },
  { "DE=14",          14 },
  { "DE=25",          25 },
  { "DE=27",          27 },
  { "DE=33",          33 },
};
const int DE_COUNT = sizeof(deCombos) / sizeof(deCombos[0]);

uint8_t slaveAddrs[] = { 1, 2, 0xF8 };
const int ADDR_COUNT = sizeof(slaveAddrs) / sizeof(slaveAddrs[0]);

ModbusMaster modbus;
int g_dePin = -1;

void preTx() {
  if (g_dePin >= 0) digitalWrite(g_dePin, HIGH);
}
void postTx() {
  if (g_dePin >= 0) digitalWrite(g_dePin, LOW);
}

bool tryCombo(const UartCombo& uc, const DECombo& dc, uint8_t addr) {
  HardwareSerial& uart = (uc.uartNum == 1) ? Serial1 : Serial2;
  uart.end();
  delay(20);
  uart.begin(BAUD, SERIAL_8N1, uc.rxPin, uc.txPin);

  g_dePin = dc.dePin;
  if (g_dePin >= 0) {
    pinMode(g_dePin, OUTPUT);
    digitalWrite(g_dePin, LOW);
  }

  modbus.begin(addr, uart);
  modbus.preTransmission(preTx);
  modbus.postTransmission(postTx);

  delay(50);

  // KWS standard: read input register 0x0000 (voltage)
  uint8_t result = modbus.readInputRegisters(0x0000, 1);

  if (result == modbus.ku8MBSuccess) {
    uint16_t raw = modbus.getResponseBuffer(0);
    float voltage = raw / 10.0f;
    Serial.printf(">>> WORKS! %s | %s | addr=%u  =>  raw=0x%04X  V=%.1f\n",
                  uc.label, dc.label, addr, raw, voltage);
    Serial.flush();
    return true;
  }
  return false;
}

void setup() {
  Serial.begin(115200);
  delay(800);
  Serial.println();
  Serial.println("=== KWS-AC301L Pin Finder ===");
  Serial.printf("Combos: %d UART x %d DE x %d addr = %d total\n",
                UART_COUNT, DE_COUNT, ADDR_COUNT,
                UART_COUNT * DE_COUNT * ADDR_COUNT);
  Serial.flush();

  int matches = 0;
  for (int u = 0; u < UART_COUNT; u++) {
    Serial.printf("\n--- %s ---\n", uartCombos[u].label);
    Serial.flush();
    for (int d = 0; d < DE_COUNT; d++) {
      for (int a = 0; a < ADDR_COUNT; a++) {
        if (tryCombo(uartCombos[u], deCombos[d], slaveAddrs[a])) matches++;
      }
    }
  }

  Serial.printf("\n=== Scan complete. %d match(es). ===\n", matches);
}

void loop() { delay(5000); }
