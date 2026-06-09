import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

/** What a user may change about their own profile. Username, role and active
 *  status are intentionally NOT editable here — those stay admin-only. */
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  fullName?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(120)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phoneNumber?: string;
}
