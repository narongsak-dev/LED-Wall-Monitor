import { IsBoolean, IsNumber, IsOptional, IsString, Min, MaxLength } from 'class-validator';

export class UpsertTariffDto {
  @IsNumber()
  // Allow 0 as a valid rate. The cost-card render already gates on
  // `rate > 0 && enabled`, so a 0-rate row simply hides the card —
  // exactly what an operator wants when they haven't picked a tariff
  // yet but don't want to delete the row either.
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

  /** Toggle for the cost-card render. Defaults to true server-side so a
   *  caller that omits the field upgrades cleanly from the pre-toggle
   *  client. */
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
