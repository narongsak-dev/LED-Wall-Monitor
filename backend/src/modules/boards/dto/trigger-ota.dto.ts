import { IsString, MaxLength, MinLength } from 'class-validator';

export class TriggerOtaDto {
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  version!: string;
}
