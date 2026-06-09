export type MetricType =
  | 'voltage'
  | 'current'
  | 'power'
  | 'energy'
  | 'temperature'
  | 'humidity';

export type TimeRange =
  | 'realtime'
  | '24h'
  | '7d'
  | 'month'      // rolling 30 days
  | 'month_cal'  // current calendar month (Asia/Bangkok)
  | 'year'       // rolling 365 days
  | 'year_cal'   // current calendar year (Asia/Bangkok)
  | 'custom';

export interface TelemetryPoint {
  time: string;
  sensorId?: number;
  deviceId?: number; // backward-compat: emitted by RealtimeGateway as deviceId for now
  boardId?: number;
  siteId: number;
  voltage: number | null;
  current: number | null;
  power: number | null;
  energy: number | null;
  temperature: number | null;
  humidity?: number | null;
  raw?: Record<string, unknown>;
}

export interface TelemetryQuery {
  siteId: number;
  zoneId?: number;
  sensorId?: number;
  boardId?: number;
  metric?: MetricType;
  range: TimeRange;
  from?: string;
  to?: string;
}

export interface RealtimeUpdate {
  siteId: number;
  deviceId: number; // currently the sensor id (kept named for gateway compatibility)
  point: TelemetryPoint;
  receivedAt: string;
}

/// MQTT payload published by a Board to sites/<site>/boards/<board>/telemetry
export interface SensorReadingPayload {
  voltage?: number;
  current?: number;
  power?: number;
  energy?: number;
  temperature?: number;
  humidity?: number;
  raw?: Record<string, unknown>;
}

export interface BoardTelemetryPayload {
  boardCode: string;
  time?: string;
  ipAddress?: string;
  firmware?: string;
  sensors: Record<string, SensorReadingPayload>;
}
