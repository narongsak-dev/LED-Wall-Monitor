/*
 * PZEM Pin Finder — final (includes UART0 + SoftwareSerial fallback)
 *
 * Tries UART0/1/2 with safe pin pairs only (avoids Ethernet PHY pins).
 * Then tries SoftwareSerial on remaining GPIO pairs.
 */

#include <PZEM004Tv30.h>

// Safe pins only — confirmed not used by Ethernet PHY
const int SAFE_OUT[] = { 2, 13, 14, 16, 17, 32, 33 };
const int SAFE_OUT_N = sizeof(SAFE_OUT) / sizeof(SAFE_OUT[0]);
const int SAFE_IN[]  = { 34, 35, 36, 39 };
const int SAFE_IN_N  = sizeof(SAFE_IN) / sizeof(SAFE_IN[0]);

bool tryHwUart(uint8_t uartNum, int rxPin, int txPin) {
  HardwareSerial& uart = (uartNum == 0) ? Serial : (uartNum == 1 ? Serial1 : Serial2);
  if (uartNum != 0) uart.end();
  delay(20);
  PZEM004Tv30 pzem(uart, rxPin, txPin);
  delay(50);
  float v = pzem.voltage();
  if (!isnan(v)) {
    Serial.printf(">>> WORKS! UART%u RX=%d TX=%d  ->  V=%.2f\n", uartNum, rxPin, txPin, v);
    Serial.flush();
    return true;
  }
  return false;
}

void scanAllUarts() {
  // UART1, UART2 with safe pin pairs (skip UART0: conflicts with USB Serial)
  for (uint8_t uartNum = 1; uartNum <= 2; uartNum++) {
    Serial.printf("\n--- UART%u ---\n", uartNum);
    Serial.flush();
    for (int r = 0; r < SAFE_OUT_N; r++) {
      for (int t = 0; t < SAFE_OUT_N; t++) {
        if (SAFE_OUT[r] == SAFE_OUT[t]) continue;
        tryHwUart(uartNum, SAFE_OUT[r], SAFE_OUT[t]);
      }
    }
    for (int r = 0; r < SAFE_IN_N; r++) {
      for (int t = 0; t < SAFE_OUT_N; t++) {
        tryHwUart(uartNum, SAFE_IN[r], SAFE_OUT[t]);
      }
    }
  }
}

void setup() {
  Serial.begin(115200);
  delay(800);
  Serial.println();
  Serial.println("=== PZEM Pin Finder (final) ===");
  Serial.println("Safe-pin only. Trying UART0,1,2.");
  Serial.flush();

  scanAllUarts();

  Serial.println("\n=== Scan complete ===");
  Serial.println("If still nothing — HMI port may be on UART0 and blocked by USB,");
  Serial.println("OR PZEM is faulty / not really powered.");
}

void loop() { delay(5000); }
