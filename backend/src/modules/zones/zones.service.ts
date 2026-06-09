import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { Zone as PrismaZone } from '@prisma/client';
import type { CreateZoneDto } from './dto/create-zone.dto';
import type { UpdateZoneDto } from './dto/update-zone.dto';

@Injectable()
export class ZonesService {
  constructor(private readonly prisma: PrismaService) {}

  async listForSite(siteId: bigint) {
    const zones = await this.prisma.zone.findMany({
      where: { siteId },
      orderBy: { code: 'asc' },
    });
    return zones.map((z) => this.toPublic(z));
  }

  async findOne(id: bigint) {
    const zone = await this.prisma.zone.findUnique({ where: { id } });
    if (!zone) throw new NotFoundException('Zone not found');
    return this.toPublic(zone);
  }

  async create(dto: CreateZoneDto) {
    // Zone codes are unique inside a site (not globally), so check the
    // composite key — two sites can both have a "FLOOR-1".
    const dup = await this.prisma.zone.findUnique({
      where: { siteId_code: { siteId: BigInt(dto.siteId), code: dto.code } },
    });
    if (dup) throw new ConflictException('Zone code already exists in this site');

    const site = await this.prisma.site.findUnique({
      where: { id: BigInt(dto.siteId) },
    });
    if (!site) throw new NotFoundException('Site not found');

    const created = await this.prisma.zone.create({
      data: {
        siteId: BigInt(dto.siteId),
        code: dto.code,
        name: dto.name,
        description: dto.description,
        isActive: dto.isActive ?? true,
      },
    });
    return this.toPublic(created);
  }

  async update(id: bigint, dto: UpdateZoneDto) {
    const zone = await this.prisma.zone.findUnique({ where: { id } });
    if (!zone) throw new NotFoundException('Zone not found');

    if (dto.code && dto.code !== zone.code) {
      const dup = await this.prisma.zone.findUnique({
        where: { siteId_code: { siteId: zone.siteId, code: dto.code } },
      });
      if (dup) throw new ConflictException('Zone code already exists in this site');
    }

    const updated = await this.prisma.zone.update({
      where: { id },
      data: {
        code: dto.code ?? undefined,
        name: dto.name ?? undefined,
        description: dto.description ?? undefined,
        isActive: dto.isActive ?? undefined,
      },
    });
    return this.toPublic(updated);
  }

  async remove(id: bigint) {
    const zone = await this.prisma.zone.findUnique({ where: { id } });
    if (!zone) throw new NotFoundException('Zone not found');
    // Boards referencing this zone get zoneId = NULL via ON DELETE SET NULL.
    await this.prisma.zone.delete({ where: { id } });
    return { ok: true };
  }

  private toPublic(z: PrismaZone) {
    return {
      id: Number(z.id),
      siteId: Number(z.siteId),
      code: z.code,
      name: z.name,
      description: z.description,
      isActive: z.isActive,
      createdAt: z.createdAt.toISOString(),
    };
  }
}
