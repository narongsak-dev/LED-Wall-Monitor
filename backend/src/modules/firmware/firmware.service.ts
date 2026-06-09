import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import type { FirmwareRelease as ApiFirmwareRelease } from '@monitor/shared';
import type { FirmwareRelease as DbFirmwareRelease } from '@prisma/client';

const VERSION_RE = /^v?[\w.\-+]{1,40}$/;
const ESP32_MAGIC = 0xe9;
const MAX_SIZE = 8 * 1024 * 1024; // 8 MB — ESP32 partitions are typically 3 MB

@Injectable()
export class FirmwareService {
  private readonly log = new Logger(FirmwareService.name);
  private readonly dir: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.dir = config.get<string>('FIRMWARE_UPLOAD_DIR') ?? '/app/firmware-uploads';
    fs.mkdirSync(this.dir, { recursive: true });
  }

  /** Persist a freshly-uploaded .bin to disk and register a DB row. */
  async ingest(
    version: string,
    description: string | undefined,
    tmpFilePath: string,
    originalName: string,
    uploadedBy: bigint,
  ): Promise<ApiFirmwareRelease> {
    if (!VERSION_RE.test(version)) {
      await fs.promises.unlink(tmpFilePath).catch(() => undefined);
      throw new BadRequestException(
        'version ต้องเป็นรูปแบบ vX.Y.Z หรือคล้ายกัน (ห้ามมีเว้นวรรค / อักษรพิเศษ)',
      );
    }

    const existing = await this.prisma.firmwareRelease.findUnique({ where: { version } });
    if (existing) {
      await fs.promises.unlink(tmpFilePath).catch(() => undefined);
      throw new BadRequestException(`version "${version}" มีอยู่แล้ว`);
    }

    const stat = await fs.promises.stat(tmpFilePath);
    if (stat.size > MAX_SIZE) {
      await fs.promises.unlink(tmpFilePath).catch(() => undefined);
      throw new BadRequestException(
        `ไฟล์ใหญ่เกินขีดจำกัด (${(stat.size / 1024 / 1024).toFixed(1)} MB > ${MAX_SIZE / 1024 / 1024} MB)`,
      );
    }

    // Smoke-test the ESP32 magic byte so we reject obvious "wrong file" uploads
    // before they end up in the catalog. The board itself would just refuse to
    // boot from a bad .bin, but failing here is friendlier.
    const head = Buffer.alloc(1);
    const fd = await fs.promises.open(tmpFilePath, 'r');
    await fd.read(head, 0, 1, 0);
    await fd.close();
    if (head[0] !== ESP32_MAGIC) {
      await fs.promises.unlink(tmpFilePath).catch(() => undefined);
      throw new BadRequestException(
        `ไฟล์ไม่ใช่ ESP32 firmware (magic byte 0x${head[0].toString(16)} ≠ 0xE9)`,
      );
    }

    const sha256 = await this.hashFile(tmpFilePath);

    // Sanitize storage filename — version may contain dots / dashes.
    const safe = version.replace(/[^\w.\-]/g, '_');
    const finalName = `${safe}.bin`;
    const finalPath = path.join(this.dir, finalName);
    // Use copy + unlink instead of rename — multer writes the tmp file under
    // /tmp which is usually a tmpfs, while `this.dir` is on a bind-mounted
    // volume. Rename across filesystems raises EXDEV; copy works everywhere.
    await fs.promises.copyFile(tmpFilePath, finalPath);
    await fs.promises.unlink(tmpFilePath).catch(() => undefined);

    const row = await this.prisma.firmwareRelease.create({
      data: {
        version,
        description: description || null,
        filename: finalName,
        fileSize: stat.size,
        sha256,
        uploadedBy,
      },
    });
    this.log.log(`Firmware ingested: ${version} (${stat.size} bytes)`);
    return this.toPublic(row, originalName);
  }

  async list(): Promise<ApiFirmwareRelease[]> {
    const rows = await this.prisma.firmwareRelease.findMany({
      orderBy: { uploadedAt: 'desc' },
    });
    return rows.map((r) => this.toPublic(r));
  }

  async setActive(id: bigint, isActive: boolean): Promise<ApiFirmwareRelease> {
    const row = await this.prisma.firmwareRelease.update({
      where: { id },
      data: { isActive },
    });
    return this.toPublic(row);
  }

  async remove(id: bigint): Promise<{ ok: true }> {
    const row = await this.prisma.firmwareRelease.findUnique({ where: { id } });
    if (!row) throw new NotFoundException();
    const fp = path.join(this.dir, row.filename);
    await fs.promises.unlink(fp).catch((e) => {
      this.log.warn(`unlink firmware file failed: ${fp} — ${e.message}`);
    });
    await this.prisma.firmwareRelease.delete({ where: { id } });
    return { ok: true };
  }

  /** What the board sees when polling `GET /api/firmware/latest`. */
  async latestFor(currentVersion: string | undefined, externalBase: string) {
    const newest = await this.prisma.firmwareRelease.findFirst({
      where: { isActive: true },
      orderBy: { uploadedAt: 'desc' },
    });
    if (!newest) return { hasUpdate: false };
    if (currentVersion && currentVersion === newest.version) {
      return { hasUpdate: false };
    }
    return {
      hasUpdate: true,
      version: newest.version,
      fileSize: newest.fileSize,
      sha256: newest.sha256,
      downloadUrl: `${externalBase}/api/firmware/download/${encodeURIComponent(newest.version)}`,
    };
  }

  /** Resolve a version → on-disk path. Throws 404 if missing. */
  async pathFor(version: string): Promise<{ path: string; size: number; filename: string }> {
    const row = await this.prisma.firmwareRelease.findUnique({ where: { version } });
    if (!row) throw new NotFoundException(`Firmware version "${version}" not found`);
    if (!row.isActive) throw new ForbiddenException('firmware นี้ถูกปิดใช้งาน');
    const fp = path.join(this.dir, row.filename);
    if (!fs.existsSync(fp)) {
      throw new NotFoundException(`File missing on disk: ${row.filename}`);
    }
    return { path: fp, size: row.fileSize, filename: row.filename };
  }

  private async hashFile(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const h = crypto.createHash('sha256');
      const s = fs.createReadStream(filePath);
      s.on('data', (chunk) => h.update(chunk));
      s.on('end', () => resolve(h.digest('hex')));
      s.on('error', reject);
    });
  }

  private toPublic(r: DbFirmwareRelease, originalName?: string): ApiFirmwareRelease {
    return {
      id: Number(r.id),
      version: r.version,
      description: r.description,
      filename: originalName ?? r.filename,
      fileSize: r.fileSize,
      sha256: r.sha256,
      isActive: r.isActive,
      uploadedBy: r.uploadedBy === null ? null : Number(r.uploadedBy),
      uploadedAt: r.uploadedAt.toISOString(),
    };
  }
}
