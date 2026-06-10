import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';

export enum TimeRangeDto {
  REALTIME = 'realtime',
  TODAY = 'today',         // current calendar day (Asia/Bangkok)
  WEEK_CAL = 'week_cal',   // current ISO week (Mon-Sun), Asia/Bangkok
  H24 = '24h',
  D7 = '7d',
  MONTH = 'month',         // rolling 30 days
  MONTH_CAL = 'month_cal', // current calendar month (Asia/Bangkok)
  LAST_60D = 'last_60d',   // rolling 60 days, daily buckets
  LAST_90D = 'last_90d',   // rolling 90 days, daily buckets
  LAST_6M = 'last_6m',     // rolling 6 months, monthly buckets
  YEAR = 'year',           // rolling 12 months, monthly buckets
  YEAR_CAL = 'year_cal',   // current calendar year (Asia/Bangkok)
  CUSTOM = 'custom',
}

export enum MetricTypeDto {
  VOLTAGE = 'voltage',
  CURRENT = 'current',
  POWER = 'power',
  ENERGY = 'energy',
  TEMPERATURE = 'temperature',
}

export class QueryTelemetryDto {
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  siteId!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  zoneId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  sensorId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  boardId?: number;

  @IsOptional()
  @IsEnum(MetricTypeDto)
  metric?: MetricTypeDto;

  @IsEnum(TimeRangeDto)
  range!: TimeRangeDto;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;
}

export class PaginatedReportDto extends QueryTelemetryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize: number = 50;
}
