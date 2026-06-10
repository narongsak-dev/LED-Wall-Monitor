import { IsNumber, IsOptional, IsString, Min, MaxLength } from 'class-validator';

export class UpsertTariffDto {
  @IsNumber()
  // A 0-rate tariff would render a misleading "free electricity" card on
  // the dashboard. Require a positive rate; the operator can delete the
  // tariff (DELETE endpoint) to turn the card off instead.
  @Min(0.0001)
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
