import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '@/common/decorators/current-user.decorator';
import { PrismaService } from '@/prisma/prisma.service';
import { PasswordResetService } from './password-reset.service';
import { SubmitResetRequestDto } from './dto/submit-reset-request.dto';
import { RejectResetDto } from './dto/reject-reset.dto';

function ipOf(req: Request): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  if (Array.isArray(forwarded)) return forwarded[0] ?? null;
  if (typeof forwarded === 'string') return forwarded.split(',')[0]?.trim() ?? null;
  return req.ip ?? req.socket?.remoteAddress ?? null;
}

@ApiTags('password-reset')
@Controller()
export class PasswordResetController {
  constructor(
    private readonly resets: PasswordResetService,
    private readonly prisma: PrismaService,
  ) {}

  // ---------- PUBLIC ----------

  /** Issues a math captcha — cheap, fine to call freely from the page. */
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('auth/password-reset/captcha')
  captcha() {
    return this.resets.issueCaptcha();
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('auth/password-reset/request')
  @HttpCode(200)
  request(@Body() dto: SubmitResetRequestDto, @Req() req: Request) {
    return this.resets.submitRequest(dto, {
      ipAddress: ipOf(req),
      userAgent: req.headers['user-agent'] ?? null,
    });
  }

  // ---------- AUTHENTICATED (approval inbox) ----------

  @UseGuards(JwtAuthGuard)
  @Get('users/me/pending-resets')
  async listPending(@CurrentUser() current: AuthUser) {
    const approver = await this.prisma.user.findUnique({
      where: { id: BigInt(current.id) },
    });
    if (!approver) throw new NotFoundException();
    return this.resets.listPendingForApprover(approver);
  }

  /** Full history — every status, paginated. Same scope as the pending
   *  inbox: super_admin sees everything, site_admin sees requests from
   *  users in their site overlap. */
  @UseGuards(JwtAuthGuard)
  @Get('users/password-resets/history')
  async listHistory(
    @CurrentUser() current: AuthUser,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('userId') userId?: string,
  ) {
    const approver = await this.prisma.user.findUnique({
      where: { id: BigInt(current.id) },
    });
    if (!approver) throw new NotFoundException();
    const lim = Math.max(1, Math.min(200, Number(limit) || 20));
    const off = Math.max(0, Number(offset) || 0);
    const uidNum = userId ? Number(userId) : NaN;
    const uid = Number.isFinite(uidNum) && uidNum > 0 ? BigInt(uidNum) : null;
    return this.resets.listHistoryForApprover(approver, lim, off, uid);
  }

  @UseGuards(JwtAuthGuard)
  @Post('users/password-resets/:id/approve')
  @HttpCode(200)
  async approve(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() current: AuthUser,
  ) {
    const approver = await this.prisma.user.findUnique({
      where: { id: BigInt(current.id) },
    });
    if (!approver) throw new NotFoundException();
    return this.resets.approve(BigInt(id), approver);
  }

  @UseGuards(JwtAuthGuard)
  @Post('users/password-resets/:id/reject')
  @HttpCode(200)
  async reject(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() current: AuthUser,
    @Body() dto: RejectResetDto,
  ) {
    const approver = await this.prisma.user.findUnique({
      where: { id: BigInt(current.id) },
    });
    if (!approver) throw new NotFoundException();
    return this.resets.reject(BigInt(id), approver, dto.reason);
  }
}
