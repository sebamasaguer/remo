import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Driver } from '../../drivers/entities/driver.entity';
import { Vehicle } from '../../drivers/entities/vehicle.entity';
import { Remisera } from '../../remiseras/entities/remisera.entity';
import { TripLocation } from './trip-location.entity';

export enum TripStatus {
  REQUESTED = 'requested',
  SEARCHING = 'searching',
  ASSIGNED = 'assigned',
  DRIVER_ARRIVING = 'driver_arriving',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum PaymentMethod {
  CASH = 'cash',
  MERCADO_PAGO = 'mercado_pago',
}

export enum CancelledBy {
  PASSENGER = 'passenger',
  DRIVER = 'driver',
  SYSTEM = 'system',
}

@Entity('trips')
export class Trip {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'passenger_id' })
  passenger: User;

  @Column({ name: 'passenger_id' })
  passengerId: string;

  @ManyToOne(() => Driver, { nullable: true })
  @JoinColumn({ name: 'driver_id' })
  driver: Driver;

  @Column({ name: 'driver_id', nullable: true })
  driverId: string;

  @ManyToOne(() => Vehicle, { nullable: true })
  @JoinColumn({ name: 'vehicle_id' })
  vehicle: Vehicle;

  @Column({ name: 'vehicle_id', nullable: true })
  vehicleId: string;

  @ManyToOne(() => Remisera, { nullable: true })
  @JoinColumn({ name: 'remisera_id' })
  remisera: Remisera;

  @Column({ name: 'remisera_id', nullable: true })
  remiseraId: string;

  // Origen
  @Column({ name: 'origin_address' })
  originAddress: string;

  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    name: 'origin_coords',
  })
  originCoords: string;

  // Destino
  @Column({ name: 'destination_address' })
  destinationAddress: string;

  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    name: 'destination_coords',
  })
  destinationCoords: string;

  // Estimaciones
  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true, name: 'estimated_distance_km' })
  estimatedDistanceKm: number;

  @Column({ type: 'smallint', nullable: true, name: 'estimated_duration_min' })
  estimatedDurationMin: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true, name: 'estimated_price' })
  estimatedPrice: number;

  // Valores reales
  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true, name: 'real_distance_km' })
  realDistanceKm: number;

  @Column({ type: 'smallint', nullable: true, name: 'real_duration_min' })
  realDurationMin: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true, name: 'final_price' })
  finalPrice: number;

  @Column({ type: 'enum', enum: PaymentMethod, name: 'payment_method' })
  paymentMethod: PaymentMethod;

  // Estado y tiempos
  @Column({ type: 'enum', enum: TripStatus, default: TripStatus.REQUESTED })
  status: TripStatus;

  @Column({ name: 'assigned_at', nullable: true })
  assignedAt: Date;

  @Column({ name: 'driver_arrived_at', nullable: true })
  driverArrivedAt: Date;

  @Column({ name: 'started_at', nullable: true })
  startedAt: Date;

  @Column({ name: 'completed_at', nullable: true })
  completedAt: Date;

  @Column({ name: 'cancelled_at', nullable: true })
  cancelledAt: Date;

  @Column({ type: 'enum', enum: CancelledBy, nullable: true, name: 'cancelled_by' })
  cancelledBy: CancelledBy;

  @Column({ name: 'cancellation_reason', nullable: true })
  cancellationReason: string;

  @OneToMany(() => TripLocation, (loc) => loc.trip)
  locations: TripLocation[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
