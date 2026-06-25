import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Remisera } from '../../remiseras/entities/remisera.entity';
import { Vehicle } from './vehicle.entity';
import { DriverDocument } from './driver-document.entity';

export enum DriverType {
  REMISERA = 'remisera',
  INDEPENDENT = 'independent',
}

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  SUSPENDED = 'suspended',
}

@Entity('drivers')
export class Driver {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => Remisera, { nullable: true })
  @JoinColumn({ name: 'remisera_id' })
  remisera: Remisera;

  @Column({ name: 'remisera_id', nullable: true })
  remeseraId: string;

  @Column({ type: 'enum', enum: DriverType, default: DriverType.INDEPENDENT })
  type: DriverType;

  @Column({
    type: 'enum',
    enum: ApprovalStatus,
    default: ApprovalStatus.PENDING,
    name: 'approval_status',
  })
  approvalStatus: ApprovalStatus;

  @Column({ name: 'approved_by', nullable: true })
  approvedBy: string;

  @Column({ name: 'approved_at', nullable: true })
  approvedAt: Date;

  @Column({ name: 'rejection_reason', nullable: true })
  rejectionReason: string;

  @Column({ default: false, name: 'is_online' })
  isOnline: boolean;

  // PostGIS point — se guarda como texto WKT y TypeORM lo maneja con el tipo 'geography'
  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
    name: 'last_location',
  })
  lastLocation: string;

  @Column({ name: 'last_seen_at', nullable: true })
  lastSeenAt: Date;

  @OneToOne(() => Vehicle, (v) => v.driver)
  vehicle: Vehicle;

  @OneToMany(() => DriverDocument, (d) => d.driver)
  documents: DriverDocument[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
