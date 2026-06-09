import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { ZonesService } from './zones.service';
import { CreateZoneDto } from './dto/create-zone.dto';
import { UpdateZoneDto } from './dto/update-zone.dto';

@ApiTags('zones')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('zones')
export class ZonesController {
  constructor(private readonly zones: ZonesService) {}

  // GET /api/zones?siteId=1 — list zones in a site.
  // Anyone authenticated can read; UI filters which sites they see elsewhere.
  @Get()
  list(@Query('siteId', ParseIntPipe) siteId: number) {
    return this.zones.listForSite(BigInt(siteId));
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.zones.findOne(BigInt(id));
  }

  @Post()
  @Roles('super_admin', 'site_admin')
  create(@Body() dto: CreateZoneDto) {
    return this.zones.create(dto);
  }

  @Patch(':id')
  @Roles('super_admin', 'site_admin')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateZoneDto) {
    return this.zones.update(BigInt(id), dto);
  }

  @Delete(':id')
  @Roles('super_admin', 'site_admin')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.zones.remove(BigInt(id));
  }
}
