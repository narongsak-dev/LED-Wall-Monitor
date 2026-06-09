import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { UpsertTariffDto } from './dto/upsert-tariff.dto';

@Injectable()
export class TariffsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Returns the site's tariff, or `null` when the operator hasn't
   *  configured one yet. The UI uses `null` to show "ยังไม่ได้ตั้งค่า". */
  async getForSite(siteId: bigint) {
    const t = await this.prisma.tariff.findUnique({ where: { siteId } });
    if (!t) return null;
    return this.serialize(t);
  }

  /** Per-site upsert. There's only ever one Tariff row per Site, so an
   *  upsert keeps the API stable for the caller (no need to track whether
   *  the row exists). */
  async upsert(siteId: bigint, dto: UpsertTariffDto) {
    const site = await this.prisma.site.findUnique({ where: { id: siteId } });
    if (!site) throw new NotFoundException('Site not found');
    const t = await this.prisma.tariff.upsert({
      where: { siteId },
      update: { rate: dto.rate, currency: dto.currency ?? 'THB', name: dto.name },
      create: {
        siteId, rate: dto.rate,
        currency: dto.currency ?? 'THB', name: dto.name,
      },
    });
    return this.serialize(t);
  }

  async remove(siteId: bigint) {
    await this.prisma.tariff
      .delete({ where: { siteId } })
      .catch(() => null); // idempotent: deleting a missing tariff is fine
    return { ok: true };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private serialize(t: any) {
    return {
      siteId: Number(t.siteId),
      rate: t.rate,
      currency: t.currency,
      name: t.name,
      updatedAt: t.updatedAt.toISOString(),
    };
  }
}
