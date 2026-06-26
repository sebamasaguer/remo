import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { App, initializeApp, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

export interface TripOfferPayload {
  tripId: string;
  passengerName: string;
  passengerRating: number;
  originAddress: string;
  destinationAddress: string;
  estimatedPrice: number;
  paymentMethod: string;
  etaToPassengerMin: number;
  expiresInSeconds: number;
}

export interface TripAssignedPayload {
  tripId: string;
  driverName: string;
  driverRating: number;
  plate: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleColor: string;
  etaMinutes: number;
}

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private app: App | null = null;

  constructor(private config: ConfigService) {}

  onModuleInit() {
    const projectId = this.config.get<string>('firebase.projectId');
    const clientEmail = this.config.get<string>('firebase.clientEmail');
    const privateKey = this.config.get<string>('firebase.privateKey');

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn(
        'Firebase no configurado — las notificaciones push se loguean en consola (modo dev)',
      );
      return;
    }

    this.app = initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });

    this.logger.log(`Firebase inicializado (project: ${projectId})`);
  }

  // ─── Base ─────────────────────────────────────────────────────────────────────

  async send(
    fcmToken: string | null | undefined,
    title: string,
    body: string,
    data: Record<string, string> = {},
  ): Promise<void> {
    if (!fcmToken) return;

    if (!this.app) {
      this.logger.debug(`[FCM dev] → ${title}: ${body} | data: ${JSON.stringify(data)}`);
      return;
    }

    try {
      await getMessaging(this.app).send({
        token: fcmToken,
        notification: { title, body },
        data,
        android: { priority: 'high' },
        apns: { payload: { aps: { contentAvailable: true } } },
      });
    } catch (err: any) {
      // Token inválido/expirado: no propagar el error, solo loguear
      if (
        err?.errorInfo?.code === 'messaging/registration-token-not-registered' ||
        err?.errorInfo?.code === 'messaging/invalid-registration-token'
      ) {
        this.logger.warn(`FCM token inválido para envío: ${fcmToken.slice(0, 20)}...`);
      } else {
        this.logger.error(`Error FCM: ${err.message}`);
      }
    }
  }

  // ─── Eventos de viaje ─────────────────────────────────────────────────────────

  async notifyTripOffer(fcmToken: string | null | undefined, payload: TripOfferPayload) {
    await this.send(
      fcmToken,
      'Nueva solicitud de viaje',
      `${payload.originAddress} → ${payload.destinationAddress}`,
      {
        type: 'TRIP_OFFER',
        tripId: payload.tripId,
        passengerName: payload.passengerName,
        passengerRating: String(payload.passengerRating),
        originAddress: payload.originAddress,
        destinationAddress: payload.destinationAddress,
        estimatedPrice: String(payload.estimatedPrice),
        paymentMethod: payload.paymentMethod,
        etaToPassengerMin: String(payload.etaToPassengerMin),
        expiresInSeconds: String(payload.expiresInSeconds),
      },
    );
  }

  async notifyTripAssigned(fcmToken: string | null | undefined, payload: TripAssignedPayload) {
    await this.send(
      fcmToken,
      'Conductor asignado',
      `${payload.driverName} va en camino · ${payload.plate} ${payload.vehicleColor}`,
      {
        type: 'TRIP_ASSIGNED',
        tripId: payload.tripId,
        driverName: payload.driverName,
        driverRating: String(payload.driverRating),
        plate: payload.plate,
        vehicleBrand: payload.vehicleBrand,
        vehicleModel: payload.vehicleModel,
        vehicleColor: payload.vehicleColor,
        etaMinutes: String(payload.etaMinutes),
      },
    );
  }

  async notifyTripCancelled(
    fcmToken: string | null | undefined,
    tripId: string,
    reason: string,
  ) {
    const messages: Record<string, string> = {
      no_drivers_available: 'No hay conductores disponibles cerca.',
      passenger_cancelled: 'El pasajero canceló el viaje.',
    };

    await this.send(
      fcmToken,
      'Viaje cancelado',
      messages[reason] ?? 'El viaje fue cancelado.',
      { type: 'TRIP_CANCELLED', tripId, reason },
    );
  }

  async notifyPaymentConfirmed(
    fcmToken: string | null | undefined,
    tripId: string,
    method: string,
    amount: number,
  ) {
    await this.send(
      fcmToken,
      'Pago confirmado',
      `$${amount.toFixed(2)} recibido via ${method === 'mercado_pago' ? 'Mercado Pago' : 'efectivo'}`,
      { type: 'PAYMENT_CONFIRMED', tripId, method, amount: String(amount) },
    );
  }

  async notifyRatingReceived(fcmToken: string | null | undefined, score: number) {
    await this.send(
      fcmToken,
      'Nueva calificación',
      `Recibiste ${score} estrella${score !== 1 ? 's' : ''} por tu último viaje.`,
      { type: 'RATING_RECEIVED', score: String(score) },
    );
  }
}
