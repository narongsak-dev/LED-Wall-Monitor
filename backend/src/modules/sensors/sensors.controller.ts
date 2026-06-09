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
import { SensorsService } from './sensors.service';
import { CreateSensorDto } from './dto/create-sensor.dto';
import { UpdateSensorDto } from './dto/update-sensor.dto';

@ApiTags('sensors')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sensors')
export class SensorsController {
  constructor(private readonly sensors: SensorsService) {}

  @Get()
  listAll(
    @Query('boardId') boardId?: string,
    @Query('siteId') siteId?: string,
  ) {
    return this.sensors.listAll({
      boardId: boardId ? Number(boardId) : undefined,
      siteId: siteId ? Number(siteId) : undefined,
    });
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.sensors.findOne(BigInt(id));
  }

  @Post()
  @Roles('super_admin', 'site_admin')
  create(@Body() dto: CreateSensorDto) {
    return this.sensors.create(dto);
  }

  @Patch(':id')
  @Roles('super_admin', 'site_admin')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSensorDto) {
    return this.sensors.update(BigInt(id), dto);
  }

  @Delete(':id')
  @Roles('super_admin', 'site_admin')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.sensors.remove(BigInt(id));
  }
}
