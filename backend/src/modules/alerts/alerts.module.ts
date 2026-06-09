import { Module } from '@nestjs/common';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { AlertRulesService } from './alert-rules.service';

@Module({
  controllers: [AlertsController],
  providers: [AlertsService, AlertRulesService],
  exports: [AlertsService],
})
export class AlertsModule {}
