import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { MustChangePasswordGuard } from './common/guards/must-change-password.guard';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { SitesModule } from './modules/sites/sites.module';
import { ZonesModule } from './modules/zones/zones.module';
import { BoardsModule } from './modules/boards/boards.module';
import { SensorsModule } from './modules/sensors/sensors.module';
import { TelemetryModule } from './modules/telemetry/telemetry.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { MqttModule } from './modules/mqtt/mqtt.module';
import { HealthModule } from './modules/health/health.module';
import { PasswordResetModule } from './modules/password-reset/password-reset.module';
import { FirmwareModule } from './modules/firmware/firmware.module';
import { TariffsModule } from './modules/tariffs/tariffs.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { envValidationSchema } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    SitesModule,
    ZonesModule,
    BoardsModule,
    SensorsModule,
    TelemetryModule,
    RealtimeModule,
    MqttModule,
    HealthModule,
    PasswordResetModule,
    FirmwareModule,
    TariffsModule,
    AlertsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: MustChangePasswordGuard }],
})
export class AppModule {}
