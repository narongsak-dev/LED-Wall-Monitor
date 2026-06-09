import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  forwardRef,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { BoardsService } from './boards.service';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';
import { TriggerOtaDto } from './dto/trigger-ota.dto';
import { MqttService } from '../mqtt/mqtt.service';
import { FirmwareService } from '../firmware/firmware.service';

@ApiTags('boards')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('boards')
export class BoardsController {
  constructor(
    private readonly boards: BoardsService,
    @Inject(forwardRef(() => MqttService))
    private readonly mqtt: MqttService,
    private readonly firmware: FirmwareService,
  ) {}

  // Read endpoints are open to any authenticated user; site_admin / viewer
  // get UI filtered by their UserSite associations.
  @Get()
  listAll(@Query('siteId') siteId?: string) {
    return this.boards.listAll(siteId ? Number(siteId) : undefined);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.boards.findOne(BigInt(id));
  }

  // Mutations: site_admin can manage boards in their sites; viewer cannot.
  @Post()
  @Roles('super_admin', 'site_admin')
  create(@Body() dto: CreateBoardDto) {
    return this.boards.create(dto);
  }

  @Patch(':id')
  @Roles('super_admin', 'site_admin')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBoardDto) {
    return this.boards.update(BigInt(id), dto);
  }

  @Delete(':id')
  @Roles('super_admin', 'site_admin')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.boards.remove(BigInt(id));
  }

  /** Trigger an OTA install on the board: backend publishes an MQTT cmd
   *  to the board, which then downloads + flashes itself. The board's
   *  outbound MQTT link does the work — backend never has to reach the
   *  board's private IP. */
  @Post(':id/firmware-update')
  @HttpCode(202)
  @Roles('super_admin')
  async triggerOta(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: TriggerOtaDto,
    @Req() req: Request,
  ) {
    if (!dto.version) throw new BadRequestException('version is required');
    // Resolve the firmware release and build the absolute download URL.
    // We reuse FirmwareService.pathFor only to assert the file exists +
    // pick up the filename. The board pulls from /api/firmware/download.
    await this.firmware.pathFor(dto.version);
    const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    if (!host) throw new BadRequestException('Cannot determine public host');
    const downloadUrl = `${proto}://${host}/api/firmware/download/${encodeURIComponent(dto.version)}`;
    await this.mqtt.triggerBoardOta(BigInt(id), dto.version, downloadUrl);
    return { ok: true, version: dto.version };
  }

  /** Current OTA status for a board (in-memory snapshot from the last
   *  MQTT event). Frontend uses this to seed the UI, then subscribes to
   *  the `board:ota_status` socket event for live updates. */
  @Get(':id/ota-status')
  getOtaStatus(@Param('id', ParseIntPipe) id: number) {
    const status = this.mqtt.getOtaStatus(id);
    if (!status) throw new NotFoundException('No status yet for this board');
    return status;
  }
}
