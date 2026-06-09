import { IsString, MaxLength, MinLength } from 'class-validator';

export class FinishResetDto {
  @IsString()
  @MinLength(6)
  @MaxLength(72)
  newPassword!: string;
}
