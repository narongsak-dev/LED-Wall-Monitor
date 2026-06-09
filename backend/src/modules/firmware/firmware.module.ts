import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { FirmwareController } from './firmware.controller';
import { FirmwareService } from './firmware.service';

@Module({
  imports: [PrismaModule],
  controllers: [FirmwareController],
  providers: [FirmwareService],
  exports: [FirmwareService],
})
export class FirmwareModule {}
