import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../redis/redis.module';

const OTP_TTL_SECONDS = 300; // 5 minutos
const OTP_ATTEMPTS_KEY_TTL = 3600; // 1 hora para el contador de intentos
const MAX_ATTEMPTS = 5;

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly isDev: boolean;

  constructor(
    @Inject(REDIS_CLIENT) private redis: Redis,
    private config: ConfigService,
  ) {
    this.isDev = config.get('app.nodeEnv') === 'development';
  }

  async sendOtp(phone: string): Promise<void> {
    const code = this.generateCode();

    await this.redis.set(`otp:${phone}`, code, 'EX', OTP_TTL_SECONDS);

    if (this.isDev) {
      // En desarrollo el código se loggea — no se envía SMS
      this.logger.log(`[DEV] OTP para ${phone}: ${code}`);
      return;
    }

    await this.sendSms(phone, code);
  }

  async verifyOtp(phone: string, code: string): Promise<boolean> {
    const attemptsKey = `otp:attempts:${phone}`;

    const attempts = await this.redis.incr(attemptsKey);
    if (attempts === 1) {
      await this.redis.expire(attemptsKey, OTP_ATTEMPTS_KEY_TTL);
    }

    if (attempts > MAX_ATTEMPTS) {
      return false;
    }

    const stored = await this.redis.get(`otp:${phone}`);
    if (!stored || stored !== code) {
      return false;
    }

    // Código correcto → limpia ambas claves
    await this.redis.del(`otp:${phone}`, attemptsKey);
    return true;
  }

  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private async sendSms(phone: string, code: string): Promise<void> {
    // Integración con Twilio — se activa cuando las vars de entorno estén configuradas
    const accountSid = this.config.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.config.get<string>('TWILIO_AUTH_TOKEN');
    const from = this.config.get<string>('TWILIO_PHONE_NUMBER');

    if (!accountSid || !authToken || !from) {
      this.logger.warn('Twilio no configurado — OTP no enviado');
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const twilio = require('twilio');
    const client = twilio(accountSid, authToken);

    await client.messages.create({
      body: `Tu código REMO es: ${code}. Válido por 5 minutos.`,
      from,
      to: phone,
    });
  }
}
