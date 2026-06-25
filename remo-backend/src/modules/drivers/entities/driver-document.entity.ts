import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Driver } from './driver.entity';

export enum DocumentType {
  DNI_FRONT = 'dni_front',
  DNI_BACK = 'dni_back',
  SELFIE = 'selfie',
  LICENSE = 'license',
  MUNICIPAL_PERMIT = 'municipal_permit',
  VTV = 'vtv',
  INSURANCE = 'insurance',
}

export enum DocumentStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}

@Entity('driver_documents')
export class DriverDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Driver, (d) => d.documents)
  @JoinColumn({ name: 'driver_id' })
  driver: Driver;

  @Column({ name: 'driver_id' })
  driverId: string;

  @Column({ type: 'enum', enum: DocumentType })
  type: DocumentType;

  @Column({ name: 'file_url' })
  fileUrl: string;

  @Column({ name: 'expires_at', nullable: true, type: 'date' })
  expiresAt: Date;

  @Column({ type: 'enum', enum: DocumentStatus, default: DocumentStatus.PENDING })
  status: DocumentStatus;

  @Column({ name: 'reviewed_by', nullable: true })
  reviewedBy: string;

  @Column({ name: 'reviewed_at', nullable: true })
  reviewedAt: Date;

  @CreateDateColumn({ name: 'uploaded_at' })
  uploadedAt: Date;
}
