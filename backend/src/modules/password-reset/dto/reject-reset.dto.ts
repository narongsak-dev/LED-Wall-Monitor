import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectResetDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
