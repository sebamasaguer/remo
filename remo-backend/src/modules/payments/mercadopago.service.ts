import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MercadoPagoService {
  private readonly logger = new Logger(MercadoPagoService.name);
  private readonly accessToken: string;

  constructor(private config: ConfigService) {
    this.accessToken = this.config.get<string>('MP_ACCESS_TOKEN') ?? '';
  }

  async createPreference(tripId: string, amount: number, passengerEmail: string) {
    if (!this.accessToken) {
      this.logger.warn('Mercado Pago no configurado — preferencia simulada');
      return { id: `sim_${tripId}`, initPoint: null };
    }

    const { MercadoPagoConfig, Preference } = await import('mercadopago');

    const client = new MercadoPagoConfig({ accessToken: this.accessToken });
    const preference = new Preference(client);

    const response = await preference.create({
      body: {
        items: [
          {
            id: tripId,
            title: 'Viaje REMO',
            quantity: 1,
            unit_price: amount,
            currency_id: 'ARS',
          },
        ],
        payer: { email: passengerEmail },
        external_reference: tripId,
        notification_url: `${this.config.get('APP_URL')}/api/v1/payments/webhook`,
        auto_return: 'approved',
      },
    });

    return { id: response.id, initPoint: response.init_point };
  }

  async getPayment(mpPaymentId: string) {
    if (!this.accessToken) return null;

    const { MercadoPagoConfig, Payment } = await import('mercadopago');
    const client = new MercadoPagoConfig({ accessToken: this.accessToken });
    const paymentClient = new Payment(client);

    return paymentClient.get({ id: mpPaymentId });
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    const secret = this.config.get<string>('MP_WEBHOOK_SECRET');
    if (!secret) return true; // en dev no verificamos

    const crypto = require('crypto');
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    return expected === signature;
  }
}
