import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @MinLength(3)
  username!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  /** When true, the refresh token is issued with a 90-day expiry instead of
   * the short default, so the user can come back next week without logging
   * in again. The frontend additionally skips its idle-logout timer. */
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
