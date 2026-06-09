import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { AdminGuard } from '@/common/guards/admin.guard';
import { CurrentUser, AuthUser } from '@/common/decorators/current-user.decorator';
import { FirmwareService } from './firmware.service';

const TMP_DIR = process.env.FIRMWARE_TMP_DIR ?? path.join(os.tmpdir(), 'led-fw-uploads');
fs.mkdirSync(TMP_DIR, { recursive: true });

@ApiTags('firmware')
@Controller('firmware')
export class FirmwareController {
  constructor(private readonly fw: FirmwareService) {}

  // ─── PUBLIC (board polling) ─────────────────────────────────────────
  // Boards have no JWT, so these endpoints are open. The risk is minimal —
  // metadata is non-sensitive and the .bin itself is already signed by
  // whoever flashed the catalog. Rate-limit applied at the global throttler.

  /** Board polls this with its current version. Returns {hasUpdate, version,
   *  downloadUrl} so the board can decide whether to flash. */
  @Get('latest')
  async latest(
    @Query('current') current: string | undefined,
    @Req() req: Request,
  ) {
    // Compose the absolute URL the board should hit. We strip any path so
    // the same backend behind different proxies still produces a valid URL.
    const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const base = `${proto}://${host}`;
    return this.fw.latestFor(current, base);
  }

  /** Public download stream — the URL above sends the board here. */
  @Get('download/:version')
  async download(@Param('version') version: string, @Res() res: Response) {
    const { path: fp, size, filename } = await this.fw.pathFor(version);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', String(size));
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    fs.createReadStream(fp).pipe(res);
  }

  // ─── AUTHENTICATED (admin catalog management) ───────────────────────

  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
  list() {
    return this.fw.list();
  }

  @Post('upload')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @UseInterceptors(
    FileInterceptor('firmware', {
      storage: diskStorage({
        destination: TMP_DIR,
        filename: (_req, file, cb) => {
          // Random tmp name; the service renames to a sane final name after
          // it validates the version + magic byte.
          cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.originalname}`);
        },
      }),
      limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB hard cap
    }),
  )
  upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('version') version: string | undefined,
    @Body('description') description: string | undefined,
    @CurrentUser() current: AuthUser,
  ) {
    if (!file) throw new BadRequestException('ต้องแนบไฟล์ .bin');
    if (!version) {
      // Clean up the tmp file before throwing.
      fs.unlink(file.path, () => undefined);
      throw new BadRequestException('ต้องระบุ version');
    }
    return this.fw.ingest(version, description, file.path, file.originalname, BigInt(current.id));
  }

  @Patch(':id/active')
  @UseGuards(JwtAuthGuard, AdminGuard)
  setActive(
    @Param('id', ParseIntPipe) id: number,
    @Body('isActive') isActive: boolean,
  ) {
    return this.fw.setActive(BigInt(id), !!isActive);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(200)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.fw.remove(BigInt(id));
  }
}
