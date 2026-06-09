import {
  Body, Controller, Delete, Get, Param, ParseIntPipe, Put, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { TariffsService } from './tariffs.service';
import { UpsertTariffDto } from './dto/upsert-tariff.dto';

@ApiTags('tariffs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sites/:siteId/tariff')
export class TariffsController {
  constructor(private readonly tariffs: TariffsService) {}

  @Get()
  get(@Param('siteId', ParseIntPipe) siteId: number) {
    return this.tariffs.getForSite(BigInt(siteId));
  }

  @Put()
  @Roles('super_admin', 'site_admin')
  upsert(@Param('siteId', ParseIntPipe) siteId: number, @Body() dto: UpsertTariffDto) {
    return this.tariffs.upsert(BigInt(siteId), dto);
  }

  @Delete()
  @Roles('super_admin', 'site_admin')
  remove(@Param('siteId', ParseIntPipe) siteId: number) {
    return this.tariffs.remove(BigInt(siteId));
  }
}
