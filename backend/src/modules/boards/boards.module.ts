import { forwardRef, Module } from '@nestjs/common';
import { BoardsController } from './boards.controller';
import { BoardsService } from './boards.service';
import { MqttModule } from '../mqtt/mqtt.module';
import { FirmwareModule } from '../firmware/firmware.module';

@Module({
  imports: [forwardRef(() => MqttModule), FirmwareModule],
  controllers: [BoardsController],
  providers: [BoardsService],
  exports: [BoardsService],
})
export class BoardsModule {}
