import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateBoardDto {
  @IsInt()
  @IsPositive()
  siteId!: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  zoneId?: number | null;

  @IsString()
  @MinLength(3)
  code!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  hardware?: string;

  @IsOptional()
  @IsString()
  firmware?: string;

  @IsOptional()
  @IsString()
  macAddress?: string;

  @IsOptional()
  @IsString()
  ipAddress?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
