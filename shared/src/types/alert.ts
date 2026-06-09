export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface Alert {
  id: number;
  siteId: number;
  zoneId: number | null;
  boardId: number | null;
  sensorId: number | null;
  severity: AlertSeverity;
  code: string;        // e.g. 'board_offline', 'voltage_low', 'temperature_high'
  message: string;
  createdAt: string;
  resolvedAt: string | null;
  acknowledgedAt: string | null;
  acknowledgedBy: number | null;
  ackUser: {
    id: number;
    username: string;
    fullName: string | null;
  } | null;
}

export interface ZoneSummaryRow {
  zoneId: number | null;
  zoneCode: string | null;
  zoneName: string | null;
  boardCount: number;
  sensorCount: number;
  energy: number;
  powerAvg: number;
  powerMax: number;
}
