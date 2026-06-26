import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('fare_configs')
export class FareConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'decimal', precision: 8, scale: 2, name: 'base_fare' })
  baseFare: number;

  @Column({ type: 'decimal', precision: 6, scale: 2, name: 'price_per_km' })
  pricePerKm: number;

  @Column({ type: 'decimal', precision: 6, scale: 2, name: 'price_per_min' })
  pricePerMin: number;

  @Column({ type: 'decimal', precision: 4, scale: 2, default: 10, name: 'platform_commission_pct' })
  platformCommissionPct: number;

  @Column({ default: true, name: 'is_active' })
  isActive: boolean;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
