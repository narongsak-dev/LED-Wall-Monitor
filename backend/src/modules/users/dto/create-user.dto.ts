import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SitePermissionDto {
  @IsInt()
  siteId!: number;

  @IsEnum(['read', 'write', 'admin'])
  permission!: 'read' | 'write' | 'admin';
}

export class CreateUserDto {
  @IsString()
  @MinLength(3)
  username!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsEnum(['super_admin', 'site_admin', 'viewer'])
  role!: 'super_admin' | 'site_admin' | 'viewer';

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SitePermissionDto)
  sitePermissions?: SitePermissionDto[];
}
