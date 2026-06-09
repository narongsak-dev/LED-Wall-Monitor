import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '@/common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { FinishResetDto } from './dto/finish-reset.dto';
import { UsersService } from '../users/users.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const forwarded = req.headers['x-forwarded-for'];
    const ipAddress =
      (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0]?.trim()) ||
      req.ip ||
      req.socket?.remoteAddress ||
      null;
    const userAgent = req.headers['user-agent'] ?? null;

    const tokens = await this.auth.login(dto.username, dto.password, {
      ipAddress,
      userAgent,
      rememberMe: dto.rememberMe,
    });
    const user = await this.users.findByUsername(dto.username);
    return { ...tokens, user: this.users.toPublic(user!) };
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  /** Finishes the password-reset flow. Only callable when the caller's JWT
   *  carries `mustChangePassword=true` (the global MustChangePasswordGuard
   *  whitelists this path). Sets the new password and returns fresh tokens
   *  with the flag cleared so the SPA can swap them in and unlock the app. */
  @Post('finish-reset')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async finishReset(
    @CurrentUser() current: AuthUser,
    @Body() dto: FinishResetDto,
  ) {
    if (!current.mustChangePassword) {
      throw new ForbiddenException(
        'endpoint นี้ใช้ได้เฉพาะหลัง login ด้วยรหัสยืนยันเท่านั้น',
      );
    }
    await this.users.setPasswordAfterReset(BigInt(current.id), dto.newPassword);
    return this.auth.issueTokensAfterReset(BigInt(current.id));
  }
}
