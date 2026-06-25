import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum UserRole {
  PASSENGER = 'passenger',
  DRIVER = 'driver',
  REMISERA_ADMIN = 'remisera_admin',
  ADMIN = 'admin',
}

export enum UserStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  BANNED = 'banned',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 20 })
  phone: string;

  @Column({ nullable: true, length: 100 })
  name: string;

  @Column({ nullable: true, unique: true, length: 150 })
  email: string;

  @Column({ nullable: true, name: 'avatar_url' })
  avatarUrl: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.PASSENGER })
  role: UserRole;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.ACTIVE })
  status: UserStatus;

  @Column({ type: 'decimal', precision: 2, scale: 1, default: 5.0, name: 'rating_avg' })
  ratingAvg: number;

  @Column({ default: 0, name: 'rating_count' })
  ratingCount: number;

  @Column({ nullable: true, name: 'fcm_token' })
  fcmToken: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
