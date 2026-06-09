import { IsNumber, IsOptional, IsString, Min, MaxLength } from 'class-validator';

export class UpsertTariffDto {
  @IsNumber()
  @Min(0)
  rate!: number;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;
}
