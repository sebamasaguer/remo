import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Driver } from './driver.entity';

@Entity('vehicles')
export class Vehicle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => Driver, (d) => d.vehicle)
  @JoinColumn({ name: 'driver_id' })
  driver: Driver;

  @Column({ name: 'driver_id' })
  driverId: string;

  @Column({ unique: true, length: 10 })
  plate: string;

  @Column({ nullable: true, length: 50 })
  brand: string;

  @Column({ nullable: true, length: 50 })
  model: string;

  @Column({ nullable: true, type: 'smallint' })
  year: number;

  @Column({ nullable: true, length: 30 })
  color: string;

  @Column({ nullable: true, name: 'photo_url' })
  photoUrl: string;

  @Column({ default: true, name: 'is_active' })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
