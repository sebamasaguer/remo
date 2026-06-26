import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Remisera, RemeseraStatus } from './entities/remisera.entity';
import { RemeseraAdmin } from './entities/remisera-admin.entity';
import { Driver, ApprovalStatus } from '../drivers/entities/driver.entity';
import { Trip, TripStatus } from '../trips/entities/trip.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { CreateRemeseraDto } from './dto/create-remisera.dto';
import { UpdateRemeseraDto } from './dto/update-remisera.dto';
import { ReviewDriverDto, ReviewAction } from '../drivers/dto/review-driver.dto';

@Injectable()
export class RemeserasService {
  constructor(
    @InjectRepository(Remisera)
    private remeseraRepository: Repository<Remisera>,

    @InjectRepository(RemeseraAdmin)
    private adminRepository: Repository<RemeseraAdmin>,

    @InjectRepository(Driver)
    private driverRepository: Repository<Driver>,

    @InjectRepository(Trip)
    private tripRepository: Repository<Trip>,

    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  // ─── Admin REMO: gestión de remiseras ────────────────────────────────────────

  async create(dto: CreateRemeseraDto): Promise<Remisera> {
    const remisera = this.remeseraRepository.create({
      name: dto.name,
      cuit: dto.cuit,
      address: dto.address,
      phone: dto.phone,
      email: dto.email,
      commissionPct: dto.commissionPct ?? 0,
    });
    return this.remeseraRepository.save(remisera);
  }

  async findAll(): Promise<Remisera[]> {
    return this.remeseraRepository.find({ order: { name: 'ASC' } });
  }

  async findById(remeseraId: string): Promise<Remisera> {
    const remisera = await this.remeseraRepository.findOne({ where: { id: remeseraId } });
    if (!remisera) throw new NotFoundException('Remisera no encontrada');
    return remisera;
  }

  async updateById(remeseraId: string, dto: UpdateRemeseraDto): Promise<Remisera> {
    await this.findById(remeseraId);
    await this.remeseraRepository.update(remeseraId, {
      name: dto.name,
      address: dto.address,
      phone: dto.phone,
      email: dto.email,
      logoUrl: dto.logoUrl,
      commissionPct: dto.commissionPct,
    });
    return this.findById(remeseraId);
  }

  async addAdmin(remeseraId: string, userId: string): Promise<RemeseraAdmin> {
    await this.findById(remeseraId);
    await this.userRepository.update(userId, { role: UserRole.REMISERA_ADMIN });
    const admin = this.adminRepository.create({ remiseraId: remeseraId, userId });
    return this.adminRepository.save(admin);
  }

  // ─── Acceso por remisera admin ────────────────────────────────────────────────

  async getMyRemisera(userId: string): Promise<Remisera> {
    const admin = await this.adminRepository.findOne({
      where: { userId },
      relations: ['remisera'],
    });
    if (!admin) throw new ForbiddenException('No sos administrador de ninguna remisera');
    return admin.remisera;
  }

  async updateMyRemisera(userId: string, dto: UpdateRemeseraDto): Promise<Remisera> {
    const remisera = await this.getMyRemisera(userId);
    return this.updateById(remisera.id, dto);
  }

  // ─── Flota (conductores de la remisera) ──────────────────────────────────────

  async getFleet(userId: string): Promise<Driver[]> {
    const remisera = await this.getMyRemisera(userId);
    return this.driverRepository.find({
      where: { remeseraId: remisera.id },
      relations: ['user', 'vehicle', 'documents'],
      order: { createdAt: 'DESC' },
    });
  }

  async getFleetDriver(userId: string, driverId: string): Promise<Driver> {
    const remisera = await this.getMyRemisera(userId);
    const driver = await this.driverRepository.findOne({
      where: { id: driverId, remeseraId: remisera.id },
      relations: ['user', 'vehicle', 'documents'],
    });
    if (!driver) throw new NotFoundException('Conductor no encontrado en tu flota');
    return driver;
  }

  async reviewFleetDriver(
    userId: string,
    driverId: string,
    dto: ReviewDriverDto,
  ): Promise<Driver> {
    const driver = await this.getFleetDriver(userId, driverId);

    const statusMap: Record<ReviewAction, ApprovalStatus> = {
      [ReviewAction.APPROVE]: ApprovalStatus.APPROVED,
      [ReviewAction.REJECT]: ApprovalStatus.REJECTED,
      [ReviewAction.SUSPEND]: ApprovalStatus.SUSPENDED,
    };

    await this.driverRepository.update(driver.id, {
      approvalStatus: statusMap[dto.action],
      approvedBy: userId,
      approvedAt: new Date(),
      rejectionReason: dto.reason ?? undefined,
    });

    return this.getFleetDriver(userId, driverId);
  }

  // ─── Historial de viajes de la flota ─────────────────────────────────────────

  async getFleetTrips(userId: string, page = 1, limit = 30) {
    const remisera = await this.getMyRemisera(userId);

    const [items, total] = await this.tripRepository.findAndCount({
      where: { remiseraId: remisera.id },
      relations: ['passenger', 'driver', 'driver.user'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { items, total, page, limit };
  }

  // ─── Reporte de ingresos ──────────────────────────────────────────────────────

  async getEarningsReport(userId: string, period: 'day' | 'week' | 'month' = 'month') {
    const remisera = await this.getMyRemisera(userId);

    const intervals: Record<string, string> = {
      day: '1 day',
      week: '7 days',
      month: '30 days',
    };

    const result = await this.tripRepository
      .createQueryBuilder('trip')
      .select('COUNT(trip.id)', 'total_trips')
      .addSelect('COALESCE(SUM(payment.amount), 0)', 'total_amount')
      .addSelect('COALESCE(SUM(payment.remisera_fee), 0)', 'remisera_earnings')
      .leftJoin('payments', 'payment', 'payment.trip_id = trip.id AND payment.status = \'completed\'')
      .where('trip.remisera_id = :id', { id: remisera.id })
      .andWhere('trip.status = :status', { status: TripStatus.COMPLETED })
      .andWhere(`trip.completed_at >= NOW() - INTERVAL '${intervals[period]}'`)
      .getRawOne();

    const byDriver = await this.tripRepository
      .createQueryBuilder('trip')
      .select('driver_user.name', 'driver_name')
      .addSelect('COUNT(trip.id)', 'trips')
      .addSelect('COALESCE(SUM(payment.amount), 0)', 'amount')
      .innerJoin('drivers', 'driver', 'driver.id = trip.driver_id')
      .innerJoin('users', 'driver_user', 'driver_user.id = driver.user_id')
      .leftJoin('payments', 'payment', 'payment.trip_id = trip.id AND payment.status = \'completed\'')
      .where('trip.remisera_id = :id', { id: remisera.id })
      .andWhere('trip.status = :status', { status: TripStatus.COMPLETED })
      .andWhere(`trip.completed_at >= NOW() - INTERVAL '${intervals[period]}'`)
      .groupBy('driver_user.name')
      .orderBy('amount', 'DESC')
      .getRawMany();

    return {
      period,
      totalTrips: parseInt(result.total_trips ?? '0', 10),
      totalAmount: parseFloat(result.total_amount ?? '0'),
      remiseraEarnings: parseFloat(result.remisera_earnings ?? '0'),
      byDriver,
    };
  }
}
