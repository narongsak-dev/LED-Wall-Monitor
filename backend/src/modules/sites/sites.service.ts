import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { Site as PrismaSite } from '@prisma/client';
import type { CreateSiteDto } from './dto/create-site.dto';
import type { UpdateSiteDto } from './dto/update-site.dto';

@Injectable()
export class SitesService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: number) {
    const records = await this.prisma.userSite.findMany({
      where: { userId: BigInt(userId), site: { isActive: true } },
      include: { site: true },
    });
    return records.map((r) => ({
      permission: r.permission,
      site: this.toPublic(r.site),
    }));
  }

  async listAll() {
    const sites = await this.prisma.site.findMany({ orderBy: { id: 'asc' } });
    return sites.map((s) => this.toPublic(s));
  }

  async findOne(id: bigint) {
    const site = await this.prisma.site.findUnique({ where: { id } });
    if (!site) throw new NotFoundException('Site not found');
    return this.toPublic(site);
  }

  async create(dto: CreateSiteDto) {
    const exists = await this.prisma.site.findUnique({ where: { code: dto.code } });
    if (exists) throw new ConflictException('Site code already exists');

    const created = await this.prisma.site.create({
      data: {
        code: dto.code,
        name: dto.name,
        groupId: dto.groupId == null ? null : BigInt(dto.groupId),
        location: dto.location,
        timezone: dto.timezone ?? 'Asia/Bangkok',
        isActive: dto.isActive ?? true,
      },
    });
    return this.toPublic(created);
  }

  async update(id: bigint, dto: UpdateSiteDto) {
    const site = await this.prisma.site.findUnique({ where: { id } });
    if (!site) throw new NotFoundException('Site not found');

    if (dto.code && dto.code !== site.code) {
      const dup = await this.prisma.site.findUnique({ where: { code: dto.code } });
      if (dup) throw new ConflictException('Site code already exists');
    }

    const updated = await this.prisma.site.update({
      where: { id },
      data: {
        code: dto.code ?? undefined,
        name: dto.name ?? undefined,
        groupId: dto.groupId === undefined
          ? undefined
          : dto.groupId === null ? null : BigInt(dto.groupId),
        location: dto.location ?? undefined,
        timezone: dto.timezone ?? undefined,
        isActive: dto.isActive ?? undefined,
      },
    });
    return this.toPublic(updated);
  }

  async remove(id: bigint) {
    const site = await this.prisma.site.findUnique({ where: { id } });
    if (!site) throw new NotFoundException('Site not found');
    await this.prisma.site.delete({ where: { id } });
    return { ok: true };
  }

  async assertUserCanAccess(userId: number, siteId: number) {
    const access = await this.prisma.userSite.findUnique({
      where: { userId_siteId: { userId: BigInt(userId), siteId: BigInt(siteId) } },
      include: { site: true },
    });
    if (!access) throw new ForbiddenException('No access to site');
    if (!access.site.isActive) throw new ForbiddenException('Site is disabled');
    return access;
  }

  private toPublic(s: PrismaSite) {
    return {
      id: Number(s.id),
      groupId: s.groupId == null ? null : Number(s.groupId),
      code: s.code,
      name: s.name,
      location: s.location,
      timezone: s.timezone,
      isActive: s.isActive,
      createdAt: s.createdAt.toISOString(),
    };
  }
}
