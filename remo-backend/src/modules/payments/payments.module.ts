import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './entities/payment.entity';
import { Trip } from '../trips/entities/trip.entity';
import { Remisera } from '../remiseras/entities/remisera.entity';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { MercadoPagoService } from './mercadopago.service';
import { FaresModule } from '../fares/fares.module';
import { GatewayModule } from '../../gateway/gateway.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, Trip, Remisera]),
    FaresModule,
    GatewayModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, MercadoPagoService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
