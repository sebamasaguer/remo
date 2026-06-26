import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentMethod, PaymentStatus } from './entities/payment.entity';
import { Trip, TripStatus, PaymentMethod as TripPaymentMethod } from '../trips/entities/trip.entity';
import { Remisera } from '../remiseras/entities/remisera.entity';
import { FaresService } from '../fares/fares.service';
import { MercadoPagoService } from './mercadopago.service';
import { AppGateway } from '../../gateway/app.gateway';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,

    @InjectRepository(Trip)
    private tripRepository: Repository<Trip>,

    @InjectRepository(Remisera)
    private remiseraRepository: Repository<Remisera>,

    private faresService: FaresService,
    private mpService: MercadoPagoService,
    private gateway: AppGateway,
    private notifications: NotificationsService,
  ) {}

  // ─── Se llama al completar el viaje ──────────────────────────────────────────

  async initiate(tripId: string): Promise<Payment> {
    const trip = await this.tripRepository.findOne({
      where: { id: tripId },
      relations: ['passenger', 'remisera'],
    });

    if (!trip) throw new NotFoundException('Viaje no encontrado');

    const existing = await this.paymentRepository.findOne({ where: { tripId } });
    if (existing) return existing;

    const amount = trip.finalPrice ?? trip.estimatedPrice ?? 0;
    const distribution = await this.calcDistribution(amount, trip);

    const payment = this.paymentRepository.create({
      tripId,
      method: trip.paymentMethod === TripPaymentMethod.MERCADO_PAGO
        ? PaymentMethod.MERCADO_PAGO
        : PaymentMethod.CASH,
      status: PaymentStatus.PENDING,
      amount,
      platformFee: distribution.platformFee,
      remiseraFee: distribution.remiseraFee,
      driverEarnings: distribution.driverEarnings,
    });

    // Si es Mercado Pago, crea la preferencia de pago
    if (payment.method === PaymentMethod.MERCADO_PAGO) {
      const pref = await this.mpService.createPreference(
        tripId,
        amount,
        trip.passenger?.email ?? '',
      );
      payment.mpPreferenceId = pref.id ?? '';

      // Notifica al pasajero con el link de pago
      this.gateway.emitToUser(trip.passengerId, 'payment:init', {
        tripId,
        amount,
        initPoint: pref.initPoint,
      });
    }

    return this.paymentRepository.save(payment);
  }

  // ─── Confirmación de efectivo ─────────────────────────────────────────────────

  async confirmCash(tripId: string, confirmedByUserId: string): Promise<Payment> {
    const payment = await this.findByTrip(tripId);

    if (payment.method !== PaymentMethod.CASH) {
      throw new BadRequestException('Este pago no es en efectivo');
    }

    if (payment.status === PaymentStatus.COMPLETED) {
      throw new BadRequestException('El pago ya fue confirmado');
    }

    await this.paymentRepository.update(payment.id, {
      status: PaymentStatus.COMPLETED,
      paidAt: new Date(),
    });

    const trip = await this.tripRepository.findOne({
      where: { id: tripId },
      relations: ['passenger', 'driver', 'driver.user'],
    });

    if (trip) {
      this.gateway.emitToUser(trip.passengerId, 'payment:confirmed', { tripId, method: 'cash' });
      this.gateway.emitToUser(trip.driverId!, 'payment:confirmed', { tripId, method: 'cash' });

      const amount = payment.amount ? Number(payment.amount) : 0;
      void this.notifications.notifyPaymentConfirmed(trip.passenger?.fcmToken, tripId, 'cash', amount);
      void this.notifications.notifyPaymentConfirmed(trip.driver?.user?.fcmToken, tripId, 'cash', amount);
    }

    return this.findByTrip(tripId);
  }

  // ─── Webhook de Mercado Pago ──────────────────────────────────────────────────

  async handleWebhook(payload: any, signature: string, rawBody: string): Promise<void> {
    if (!this.mpService.verifyWebhookSignature(rawBody, signature)) {
      this.logger.warn('Webhook MP con firma inválida');
      return;
    }

    if (payload.type !== 'payment') return;

    const mpPaymentId = String(payload.data?.id);
    const mpPayment = await this.mpService.getPayment(mpPaymentId);
    if (!mpPayment) return;

    const tripId = mpPayment.external_reference;
    if (!tripId) return;

    const payment = await this.paymentRepository.findOne({ where: { tripId } });
    if (!payment) return;

    await this.paymentRepository.update(payment.id, {
      mpPaymentId,
      mpStatus: mpPayment.status ?? '',
      status: mpPayment.status === 'approved' ? PaymentStatus.COMPLETED : PaymentStatus.FAILED,
      paidAt: mpPayment.status === 'approved' ? new Date() : undefined,
    });

    const trip = await this.tripRepository.findOne({
      where: { id: tripId },
      relations: ['passenger', 'driver', 'driver.user'],
    });

    if (trip && mpPayment.status === 'approved') {
      this.gateway.emitToUser(trip.passengerId, 'payment:confirmed', { tripId, method: 'mercado_pago' });
      this.gateway.emitToUser(trip.driverId!, 'payment:confirmed', { tripId, method: 'mercado_pago' });

      const updatedPayment = await this.findByTrip(tripId);
      const amount = updatedPayment.amount ? Number(updatedPayment.amount) : 0;
      void this.notifications.notifyPaymentConfirmed(trip.passenger?.fcmToken, tripId, 'mercado_pago', amount);
      void this.notifications.notifyPaymentConfirmed(trip.driver?.user?.fcmToken, tripId, 'mercado_pago', amount);
    }

    this.logger.log(`Webhook MP procesado: viaje ${tripId} → ${mpPayment.status}`);
  }

  // ─── Consulta ─────────────────────────────────────────────────────────────────

  async findByTrip(tripId: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({ where: { tripId } });
    if (!payment) throw new NotFoundException('Pago no encontrado');
    return payment;
  }

  // ─── Distribución de comisiones ───────────────────────────────────────────────

  private async calcDistribution(amount: number, trip: Trip) {
    const fare = await this.faresService.getActive();
    const platformPct = Number(fare.platformCommissionPct) / 100;

    let remiseraPct = 0;
    if (trip.remiseraId) {
      const remisera = await this.remiseraRepository.findOne({ where: { id: trip.remiseraId } });
      remiseraPct = remisera ? Number(remisera.commissionPct) / 100 : 0;
    }

    const platformFee = parseFloat((amount * platformPct).toFixed(2));
    const remiseraFee = parseFloat((amount * remiseraPct).toFixed(2));
    const driverEarnings = parseFloat((amount - platformFee - remiseraFee).toFixed(2));

    return { platformFee, remiseraFee, driverEarnings };
  }
}
