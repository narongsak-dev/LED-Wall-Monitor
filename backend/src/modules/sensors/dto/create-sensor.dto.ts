import {
  IsBoolean,
  IsEnum,
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
