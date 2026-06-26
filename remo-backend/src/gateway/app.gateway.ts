import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

@WebSocketGateway({ cors: { origin: '*' } })
export class AppGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AppGateway.name);

  // Referencia lazy al MatchingService para evitar dependencia circular
  private matchingService: any;

  constructor(
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  setMatchingService(service: any) {
    this.matchingService = service;
  }

  // ─── Conexión ─────────────────────────────────────────────────────────────────

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token as string | undefined;

    if (!token) {
      client.disconnect();
      return;
    }

    try {
      const payload = await this.jwt.verifyAsync(token, {
        secret: this.config.get<string>('jwt.accessSecret'),
      });

      client.data.userId = payload.sub;
      client.data.role = payload.role;

      // Cada usuario tiene su sala privada
      client.join(`user:${payload.sub}`);
      this.logger.log(`Cliente conectado: ${payload.sub} (${payload.role})`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    if (client.data.userId) {
      this.logger.log(`Cliente desconectado: ${client.data.userId}`);
    }
  }

  // ─── Eventos del conductor ────────────────────────────────────────────────────

  @SubscribeMessage('trip:accept')
  async handleAccept(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tripId: string },
  ) {
    const driverId = client.data.userId;
    if (!driverId || !this.matchingService) return;
    await this.matchingService.driverAccepted(data.tripId, driverId);
  }

  @SubscribeMessage('trip:reject')
  async handleReject(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tripId: string },
  ) {
    const driverId = client.data.userId;
    if (!driverId || !this.matchingService) return;
    await this.matchingService.driverRejected(data.tripId, driverId);
  }

  // ─── El pasajero se une al canal del viaje ────────────────────────────────────

  @SubscribeMessage('trip:join')
  handleJoinTrip(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tripId: string },
  ) {
    client.join(`trip:${data.tripId}`);
  }

  // ─── Emisores (usados por servicios internos) ─────────────────────────────────

  emitToUser(userId: string, event: string, data: unknown) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  emitToTrip(tripId: string, event: string, data: unknown) {
    this.server.to(`trip:${tripId}`).emit(event, data);
  }

  emitToDriver(driverId: string, event: string, data: unknown) {
    this.server.to(`user:${driverId}`).emit(event, data);
  }
}
