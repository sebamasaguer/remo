import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum RemeseraStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
}

@Entity('remiseras')
export class Remisera {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 150 })
  name: string;

  @Column({ nullable: true, unique: true, length: 13 })
  cuit: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true, length: 20 })
  phone: string;

  @Column({ nullable: true, length: 150 })
  email: string;

  @Column({ nullable: true, name: 'logo_url' })
  logoUrl: string;

  @Column({ type: 'enum', enum: RemeseraStatus, default: RemeseraStatus.ACTIVE })
  status: RemeseraStatus;

  @Column({ type: 'decimal', precision: 4, scale: 2, default: 0, name: 'commission_pct' })
  commissionPct: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
