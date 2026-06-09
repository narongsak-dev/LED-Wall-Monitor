import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SubmitResetRequestDto {
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  username!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(120)
  contact!: string;

  @IsString()
  @MaxLength(40)
  captchaId!: string;

  @IsString()
  @MaxLength(10)
  captchaAnswer!: string;

  /** Honeypot — real submissions leave it empty. Bots that fill every field
   *  give themselves away. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  hp?: string;
}
