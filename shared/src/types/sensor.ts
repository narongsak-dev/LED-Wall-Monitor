export type SensorType =
  | 'power_meter'
  | 'temperature'
  | 'humidity'
  | 'gateway'
  | 'other';

export interface Sensor {
  id: number;
  boardId: number;
  siteId: number;
  code: string;
  name: string | null;
  sensorType: SensorType;
  model: string | null;
  /** Phase wiring (1 or 3). NULL = not applicable. */
  phases: 1 | 3 | null;
  channel: string | null;
  isActive: boolean;
  voltageMin: number | null;
  voltageMax: number | null;
  currentMax: number | null;
  powerMax: number | null;
  temperatureMax: number | null;
}

export interface SensorWithContext extends Sensor {
  boardCode?: string;
  zoneId?: number | null;
  siteCode?: string;
  siteName?: string;
}

export interface CreateSensorPayload {
  boardId: number;
  code: string;
  name?: string;
  sensorType: SensorType;
  model?: string;
  phases?: 1 | 3 | null;
  channel?: string;
  isActive?: boolean;
  voltageMin?: number | null;
  voltageMax?: number | null;
  currentMax?: number | null;
  powerMax?: number | null;
  temperatureMax?: number | null;
}

export interface UpdateSensorPayload {
  boardId?: number;
  code?: string;
  name?: string;
  sensorType?: SensorType;
  model?: string;
  phases?: 1 | 3 | null;
  channel?: string;
  isActive?: boolean;
  voltageMin?: number | null;
  voltageMax?: number | null;
  currentMax?: number | null;
  powerMax?: number | null;
  temperatureMax?: number | null;
}
