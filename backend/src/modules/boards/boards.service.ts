import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { CreateBoardDto } from './dto/create-board.dto';
import type { UpdateBoardDto } from './dto/update-board.dto';

@Injectable()
export class BoardsService {
  constructor(private readonly prisma: PrismaService) {}

  findByCode(code: string) {
    return this.prisma.board.findUnique({
      where: { code },
      include: { sensors: true },
    });
  }

  async listAll(siteId?: number) {
    const where = siteId != null ? { siteId: BigInt(siteId) } : {};
    const boards = await this.prisma.board.findMany({
      where,
      include: { site: true, zone: true, sensors: true },
      orderBy: { id: 'asc' },
    });
    return boards.map((b) => this.serialize(b));
  }

  async findOne(id: bigint) {
    const board = await this.prisma.board.findUnique({
      where: { id },
      include: { site: true, zone: true, sensors: true },
    });
    if (!board) throw new NotFoundException('Board not found');
    return this.serialize(board);
  }

  async create(dto: CreateBoardDto) {
    const exists = await this.prisma.board.findUnique({ where: { code: dto.code } });
    if (exists) throw new ConflictException('Board code already exists');

    const site = await this.prisma.site.findUnique({
      where: { id: BigInt(dto.siteId) },
    });
    if (!site) throw new NotFoundException('Site not found');

    const created = await this.prisma.board.create({
      data: {
        siteId: BigInt(dto.siteId),
        zoneId: dto.zoneId == null ? null : BigInt(dto.zoneId),
        code: dto.code,
        name: dto.name,
        hardware: dto.hardware,
        firmware: dto.firmware,
        macAddress: dto.macAddress,
        ipAddress: dto.ipAddress,
        isActive: dto.isActive ?? true,
      },
    });
    return this.findOne(created.id);
  }

  async update(id: bigint, dto: UpdateBoardDto) {
    const board = await this.prisma.board.findUnique({ where: { id } });
    if (!board) throw new NotFoundException('Board not found');

    if (dto.code && dto.code !== board.code) {
      const dup = await this.prisma.board.findUnique({ where: { code: dto.code } });
      if (dup) throw new ConflictException('Board code already exists');
    }

    await this.prisma.board.update({
      where: { id },
      data: {
        code: dto.code ?? undefined,
        name: dto.name ?? undefined,
        // `null` clears the zone; `undefined` leaves it untouched.
        zoneId: dto.zoneId === undefined
          ? undefined
          : dto.zoneId === null ? null : BigInt(dto.zoneId),
        hardware: dto.hardware ?? undefined,
        firmware: dto.firmware ?? undefined,
        macAddress: dto.macAddress ?? undefined,
        ipAddress: dto.ipAddress ?? undefined,
        isActive: dto.isActive ?? undefined,
      },
    });
    return this.findOne(id);
  }

  async remove(id: bigint) {
    const board = await this.prisma.board.findUnique({ where: { id } });
    if (!board) throw new NotFoundException('Board not found');
    await this.prisma.board.delete({ where: { id } });
    return { ok: true };
  }

  touchLastSeen(
    boardId: bigint,
    when: Date,
    ipAddress?: string,
    firmware?: string,
  ) {
    return this.prisma.board.update({
      where: { id: boardId },
      data: {
        lastSeenAt: when,
        ipAddress: ipAddress ?? undefined,
        // Only overwrite the stored firmware version when the board actually
        // reports one. A telemetry payload from an older firmware (no field)
        // shouldn't clobber whatever we have on file.
        firmware: firmware && firmware.trim() ? firmware : undefined,
      },
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private serialize(b: any) {
    return {
      id: Number(b.id),
      siteId: Number(b.siteId),
      zoneId: b.zoneId == null ? null : Number(b.zoneId),
      code: b.code,
      name: b.name,
      hardware: b.hardware,
      firmware: b.firmware,
      macAddress: b.macAddress,
      ipAddress: b.ipAddress,
      lastSeenAt: b.lastSeenAt?.toISOString() ?? null,
      isActive: b.isActive,
      siteCode: b.site?.code,
      siteName: b.site?.name,
      zoneCode: b.zone?.code,
      zoneName: b.zone?.name,
      sensors:
        b.sensors?.map((s: { id: bigint; code: string; name: string | null }) => ({
          id: Number(s.id),
          code: s.code,
          name: s.name,
        })) ?? [],
    };
  }
}
