import { forwardRef, Module } from '@nestjs/common';
import { MqttService } from './mqtt.service';
import { TelemetryModule } from '../telemetry/telemetry.module';
import { BoardsModule } from '../boards/boards.module';
import { SensorsModule } from '../sensors/sensors.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  // BoardsModule needs MqttService for the trigger-OTA endpoint and MqttService
  // needs BoardsService to resolve boardCode → board row. forwardRef breaks
  // the cycle.
  imports: [TelemetryModule, forwardRef(() => BoardsModule), SensorsModule, RealtimeModule],
  providers: [MqttService],
  exports: [MqttService],
})
export class MqttModule {}
