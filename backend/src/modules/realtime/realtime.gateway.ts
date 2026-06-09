import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Logger, UnauthorizedException } from '@nestjs/common';
import type { RealtimeUpdate, BoardOtaStatus } from '@monitor/shared';

@WebSocketGateway({ cors: { origin: '*' } })
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly jwt: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      if (!token) throw new UnauthorizedException();
      const payload = await this.jwt.verifyAsync(token);
      client.data.user = payload;
      this.logger.log(`Client connected: ${payload.username}`);
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('site:subscribe')
  subscribeToSite(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { siteId: number },
  ) {
    client.join(`site:${data.siteId}`);
    return { ok: true };
  }

  @SubscribeMessage('site:unsubscribe')
  unsubscribeFromSite(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { siteId: number },
  ) {
    client.leave(`site:${data.siteId}`);
    return { ok: true };
  }

  broadcastTelemetry(update: RealtimeUpdate) {
    this.server.to(`site:${update.siteId}`).emit('telemetry:latest', update);
  }

  /** Emit an OTA progress event for a board. Goes to every connected client
   *  (small footprint — these events are rare) so the admin UI doesn't have
   *  to subscribe per-board. Frontend filters by boardId. */
  broadcastBoardOtaStatus(status: BoardOtaStatus) {
    this.server.emit('board:ota_status', status);
  }
}
