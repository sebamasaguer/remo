import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Trip } from '../../trips/entities/trip.entity';

export enum PaymentStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export enum PaymentMethod {
  CASH = 'cash',
  MERCADO_PAGO = 'mercado_pago',
}

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => Trip)
  @JoinColumn({ name: 'trip_id' })
  trip: Trip;

  @Column({ name: 'trip_id', unique: true })
  tripId: string;

  @Column({ type: 'enum', enum: PaymentMethod })
  method: PaymentMethod;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Column({ type: 'decimal', precision: 8, scale: 2 })
  amount: number;

  // Distribución
  @Column({ type: 'decimal', precision: 8, scale: 2, default: 0, name: 'platform_fee' })
  platformFee: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, default: 0, name: 'remisera_fee' })
  remiseraFee: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, default: 0, name: 'driver_earnings' })
  driverEarnings: number;

  // Mercado Pago
  @Column({ nullable: true, name: 'mp_payment_id' })
  mpPaymentId: string;

  @Column({ nullable: true, name: 'mp_status' })
  mpStatus: string;

  @Column({ nullable: true, name: 'mp_preference_id' })
  mpPreferenceId: string;

  @Column({ nullable: true, name: 'paid_at' })
  paidAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
