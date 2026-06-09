import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller()
export class HealthController {
  @Get('health')
  check() {
    return { status: 'ok', uptime: process.uptime(), time: new Date().toISOString() };
  }

  /**
   * Wall-clock time the way the server knows it, in Unix milliseconds.
   * Public + no auth so devices on the LAN can use this as an HTTP-based
   * time fallback when NTP (UDP 123) is blocked by upstream firewalls.
   */
  @Get('time')
  time() {
    return { timeMs: Date.now(), iso: new Date().toISOString() };
  }
}
