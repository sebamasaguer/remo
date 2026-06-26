import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Remisera } from './remisera.entity';

@Entity('remisera_admins')
export class RemeseraAdmin {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => Remisera)
  @JoinColumn({ name: 'remisera_id' })
  remisera: Remisera;

  @Column({ name: 'remisera_id' })
  remiseraId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
