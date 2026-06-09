import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '@/common/decorators/current-user.decorator';
import { TelemetryService } from './telemetry.service';
import { SitesService } from '../sites/sites.service';
import {
  PaginatedReportDto,
  QueryTelemetryDto,
} from './dto/query-telemetry.dto';

@ApiTags('telemetry')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('telemetry')
export class TelemetryController {
  constructor(
    private readonly telemetry: TelemetryService,
    private readonly sites: SitesService,
  ) {}

  @Get('latest')
  async latest(
    @Query('siteId') siteId: string,
    @Query('sensorId') sensorId?: string,
    @Query('boardId') boardId?: string,
    @Query('perSensor') perSensor?: string,
    @CurrentUser() user?: AuthUser,
  ) {
    const sId = Number(siteId);
    await this.sites.assertUserCanAccess(user!.id, sId);

    if (sensorId) return this.telemetry.latestForSensor(Number(sensorId));
    if (boardId) return this.telemetry.latestForBoard(Number(boardId));
    if (perSensor === 'true' || perSensor === '1') {
      return this.telemetry.latestPerSensorForSite(sId);
    }
    return this.telemetry.latestForSite(sId);
  }

  @Get('series')
  async series(@Query() query: QueryTelemetryDto, @CurrentUser() user: AuthUser) {
    await this.sites.assertUserCanAccess(user.id, query.siteId);
    return this.telemetry.series(query);
  }

  @Get('summary')
  async summary(@Query() query: QueryTelemetryDto, @CurrentUser() user: AuthUser) {
    await this.sites.assertUserCanAccess(user.id, query.siteId);
    return this.telemetry.summary(query);
  }

  @Get('report')
  async report(@Query() query: PaginatedReportDto, @CurrentUser() user: AuthUser) {
    await this.sites.assertUserCanAccess(user.id, query.siteId);
    return this.telemetry.report(query);
  }
}
