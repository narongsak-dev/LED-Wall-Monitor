import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { CreateSensorDto } from './dto/create-sensor.dto';
import type { UpdateSensorDto } from './dto/update-sensor.dto';

// Currently supported sensor models. Per-board restriction is enforced
// at the FAMILY level (one PZEM + one KWS at most) so swapping a KWS-AC301L
// for a KWS-AC306L still trips the conflict check.
const ALLOWED_MODELS = ['PZEM-004T', 'KWS-AC301L', 'KWS-AC306L'] as const;
type AllowedModel = (typeof ALLOWED_MODELS)[number];
type SensorFamily = 'PZEM' | 'KWS';

function normalizeModel(model: string | undefined | null): AllowedModel | null {
  if (!model) return null;
  const upper = model.toUpperCase();
  if (upper.startsWith('PZEM')) return 'PZEM-004T';
  // 3-phase KWS uses the AC306L silicon. Detect via either the canonical
  // model string or the loose "3P"/"THREE" hints customers might type in.
  if (upper.includes('AC306') || upper.includes('3P') || upper.includes('THREE')) return 'KWS-AC306L';
  if (upper.startsWith('KWS')) return 'KWS-AC301L';
  return null;
}
function familyOf(model: AllowedModel): SensorFamily {
  return model.startsWith('PZEM') ? 'PZEM' : 'KWS';
}

@Injectable()
export class SensorsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Each board may hold one sensor per FAMILY. KWS-AC301L and KWS-AC306L
   *  share the RS485 bus / slave-address slot, so picking either locks
   *  the other out — exactly the same rule the frontend enforces. */
  private async assertCanAddModel(
    boardId: bigint,
    model: AllowedModel,
    exceptSensorId?: bigint,
  ) {
    const targetFamily = familyOf(model);
    const sensors = await this.prisma.sensor.findMany({
      where: { boardId },
      select: { id: true, code: true, model: true },
    });
    const conflict = sensors.find((s) => {
      if (exceptSensorId != null && s.id === exceptSensorId) return false;
      const norm = normalizeModel(s.model);
      return norm != null && familyOf(norm) === targetFamily;
    });
    if (conflict) {
      throw new ConflictException(
        `Board already has a ${normalizeModel(conflict.model)} sensor (${conflict.code})`,
      );
    }
  }

  findByCode(code: string) {
    return this.prisma.sensor.findUnique({ where: { code } });
  }

  async listAll(filter?: { boardId?: number; siteId?: number }) {
    const where: { boardId?: bigint; siteId?: bigint } = {};
    if (filter?.boardId != null) where.boardId = BigInt(filter.boardId);
    if (filter?.siteId != null) where.siteId = BigInt(filter.siteId);

    const sensors = await this.prisma.sensor.findMany({
      where,
      include: { board: true, site: true },
      orderBy: { id: 'asc' },
    });
    return sensors.map((s) => this.serialize(s));
  }

  async findOne(id: bigint) {
    const sensor = await this.prisma.sensor.findUnique({
      where: { id },
      include: { board: true, site: true },
    });
    if (!sensor) throw new NotFoundException('Sensor not found');
    return this.serialize(sensor);
  }

  async create(dto: CreateSensorDto) {
    const exists = await this.prisma.sensor.findUnique({ where: { code: dto.code } });
    if (exists) throw new ConflictException('Sensor code already exists');

    const board = await this.prisma.board.findUnique({
      where: { id: BigInt(dto.boardId) },
    });
    if (!board) throw new NotFoundException('Board not found');

    const normalizedModel = normalizeModel(dto.model);
    if (!normalizedModel) {
      throw new BadRequestException(
        `Unsupported sensor model. Allowed: ${ALLOWED_MODELS.join(', ')}`,
      );
    }
    await this.assertCanAddModel(board.id, normalizedModel);

    const created = await this.prisma.sensor.create({
      data: {
        boardId: board.id,
        siteId: board.siteId,
        code: dto.code,
        name: dto.name,
        sensorType: dto.sensorType,
        model: dto.model,
        phases: dto.phases ?? null,
        channel: dto.channel,
        isActive: dto.isActive ?? true,
        voltageMin: dto.voltageMin ?? null,
        voltageMax: dto.voltageMax ?? null,
        currentMax: dto.currentMax ?? null,
        powerMax: dto.powerMax ?? null,
        temperatureMax: dto.temperatureMax ?? null,
      },
    });
    return this.findOne(created.id);
  }

  async update(id: bigint, dto: UpdateSensorDto) {
    const sensor = await this.prisma.sensor.findUnique({ where: { id } });
    if (!sensor) throw new NotFoundException('Sensor not found');

    if (dto.code && dto.code !== sensor.code) {
      const dup = await this.prisma.sensor.findUnique({ where: { code: dto.code } });
      if (dup) throw new ConflictException('Sensor code already exists');
    }

    let newBoardId: bigint | undefined;
    let newSiteId: bigint | undefined;
    if (dto.boardId != null && BigInt(dto.boardId) !== sensor.boardId) {
      const board = await this.prisma.board.findUnique({
        where: { id: BigInt(dto.boardId) },
      });
      if (!board) throw new NotFoundException('Board not found');
      newBoardId = board.id;
      newSiteId = board.siteId;
    }

    // Re-validate model uniqueness on the (possibly new) board.
    if (dto.model !== undefined) {
      const normalizedModel = normalizeModel(dto.model);
      if (!normalizedModel) {
        throw new BadRequestException(
          `Unsupported sensor model. Allowed: ${ALLOWED_MODELS.join(', ')}`,
        );
      }
      await this.assertCanAddModel(newBoardId ?? sensor.boardId, normalizedModel, id);
    }

    await this.prisma.sensor.update({
      where: { id },
      data: {
        boardId: newBoardId,
        siteId: newSiteId,
        code: dto.code ?? undefined,
        name: dto.name ?? undefined,
        sensorType: dto.sensorType ?? undefined,
        model: dto.model ?? undefined,
        phases: dto.phases === undefined ? undefined : dto.phases,
        channel: dto.channel ?? undefined,
        isActive: dto.isActive ?? undefined,
        voltageMin: dto.voltageMin === undefined ? undefined : dto.voltageMin,
        voltageMax: dto.voltageMax === undefined ? undefined : dto.voltageMax,
        currentMax: dto.currentMax === undefined ? undefined : dto.currentMax,
        powerMax: dto.powerMax === undefined ? undefined : dto.powerMax,
        temperatureMax: dto.temperatureMax === undefined ? undefined : dto.temperatureMax,
      },
    });
    return this.findOne(id);
  }

  async remove(id: bigint) {
    const sensor = await this.prisma.sensor.findUnique({ where: { id } });
    if (!sensor) throw new NotFoundException('Sensor not found');
    await this.prisma.sensor.delete({ where: { id } });
    return { ok: true };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private serialize(s: any) {
    return {
      id: Number(s.id),
      boardId: Number(s.boardId),
      siteId: Number(s.siteId),
      code: s.code,
      name: s.name,
      sensorType: s.sensorType,
      model: s.model,
      phases: s.phases ?? null,
      channel: s.channel,
      isActive: s.isActive,
      voltageMin: s.voltageMin ?? null,
      voltageMax: s.voltageMax ?? null,
      currentMax: s.currentMax ?? null,
      powerMax: s.powerMax ?? null,
      temperatureMax: s.temperatureMax ?? null,
      boardCode: s.board?.code,
      zoneId: s.board?.zoneId != null ? Number(s.board.zoneId) : null,
      siteCode: s.site?.code,
      siteName: s.site?.name,
    };
  }
}
