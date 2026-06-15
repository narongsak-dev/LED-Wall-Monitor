import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MinLength,
} from 'class-validator';

export const SENSOR_TYPES = [
  'power_meter',
  'temperature',
  'humidity',
  'gateway',
  'other',
] as const;
export type SensorTypeName = (typeof SENSOR_TYPES)[number];

export class CreateSensorDto {
  @IsInt()
  @IsPositive()
  boardId!: number;

  @IsString()
  @MinLength(3)
  code!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsEnum(SENSOR_TYPES)
  sensorType!: SensorTypeName;

  @IsOptional()
  @IsString()
  model?: string;

  // Phase wiring (1 or 3) for KWS-family sensors. Optional — leave
  // unset (null) for PZEM and other non-3-phase-capable hardware.
  @IsOptional()
  @IsIn([1, 3, null])
  phases?: 1 | 3 | null;

  @IsOptional()
  @IsString()
  channel?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  voltageMin?: number;

  @IsOptional()
  @IsNumber()
  voltageMax?: number;

  @IsOptional()
  @IsNumber()
  currentMax?: number;

  @IsOptional()
  @IsNumber()
  powerMax?: number;

  @IsOptional()
  @IsNumber()
  temperatureMax?: number;
}
