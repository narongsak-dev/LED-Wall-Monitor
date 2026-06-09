import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { PasswordResetController } from './password-reset.controller';
import { PasswordResetService } from './password-reset.service';
import { CaptchaService } from './captcha.service';

@Module({
  imports: [PrismaModule],
  controllers: [PasswordResetController],
  providers: [PasswordResetService, CaptchaService],
})
export class PasswordResetModule {}
