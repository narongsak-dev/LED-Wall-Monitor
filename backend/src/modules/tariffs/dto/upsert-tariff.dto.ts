import { IsBoolean, IsNumber, IsOptional, IsString, Min, MaxLength } from 'class-validator';

export class UpsertTariffDto {
  @IsNumber()
  // 0-rate tariffs are blocked here so the frontend toggle is the only
  // way to "turn the card off" — keeping the configured rate intact.
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

  /** Toggle for the cost-card render. Defaults to true server-side so a
   *  caller that omits the field upgrades cleanly from the pre-toggle
   *  client. */
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
