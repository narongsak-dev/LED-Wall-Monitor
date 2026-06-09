// Fake board-level MQTT publisher for testing the pipeline before real hardware.
// Usage:  node scripts/fake-publish.js [board-code] [site-code]
//
// The board publishes ONE message per cycle containing readings for every
// sensor attached to it.

import mqtt from 'mqtt';

const BOARD_CODE = process.argv[2] ?? 'BOARD-001';
const SITE_CODE = process.argv[3] ?? 'SITE-001';
const MQTT_URL = process.env.MQTT_URL ?? 'mqtt://localhost:1883';
const INTERVAL_MS = 3000;

// Edit this list to mirror what is attached to BOARD_CODE in the DB.
const SENSORS = [
  { code: 'PZEM-001', kind: 'power' },
  // { code: 'KWS-001', kind: 'power+temp' },  // enable after MAX485 is wired
];

const topic = `sites/${SITE_CODE}/boards/${BOARD_CODE}/telemetry`;
const client = mqtt.connect(MQTT_URL, { clientId: `fake-board-${BOARD_CODE}` });

function makeReading(kind) {
  const base = {
    voltage: 220 + Math.random() * 10,
    current: 1 + Math.random() * 5,
    power: 250 + Math.random() * 800,
    energy: 12.345 + Math.random(),
    raw: {
      pf: 0.95 + Math.random() * 0.04,
      frequency: 49.9 + Math.random() * 0.2,
    },
  };
  if (kind === 'power+temp') {
    base.temperature = 25 + Math.random() * 5;
  }
  return base;
}

client.on('connect', () => {
  console.log(`connected to ${MQTT_URL}`);
  console.log(`publishing to ${topic} every ${INTERVAL_MS}ms`);
  setInterval(() => {
    const sensors = {};
    for (const s of SENSORS) sensors[s.code] = makeReading(s.kind);

    const payload = {
      boardCode: BOARD_CODE,
      time: new Date().toISOString(),
      firmware: 'fake-v0.1.0',
      sensors,
    };
    client.publish(topic, JSON.stringify(payload), { qos: 1 });
    console.log('→', JSON.stringify(payload));
  }, INTERVAL_MS);
});

client.on('error', (err) => console.error('MQTT error:', err.message));
