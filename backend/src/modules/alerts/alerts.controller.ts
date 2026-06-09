import {
  Controller, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { AlertsService } from './alerts.service';

@ApiTags('alerts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  /** Dashboard pulls this once per site. `open=true` (default) is the
   *  unresolved-only view that drives the in-app alert panel. */
  @Get()
  list(
    @Query('siteId', ParseIntPipe) siteId: number,
    @Query('open') open?: string,
  ) {
    const openFlag = open == null ? true : open !== 'false';
    return this.alerts.list(BigInt(siteId), { open: openFlag });
  }

  @Post(':id/acknowledge')
  @Roles('super_admin', 'site_admin')
  ack(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const userId = BigInt((req.user as { id: number }).id);
    return this.alerts.acknowledge(BigInt(id), userId);
  }

  @Post(':id/resolve')
  @Roles('super_admin', 'site_admin')
  resolve(@Param('id', ParseIntPipe) id: number) {
    return this.alerts.resolve(BigInt(id));
  }
}
