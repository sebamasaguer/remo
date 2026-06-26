import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserStatus } from '../users/entities/user.entity';
import { Driver, ApprovalStatus, DriverType } from '../drivers/entities/driver.entity';
import { Trip, TripStatus } from '../trips/entities/trip.entity';
import { FareConfig } from '../fares/entities/fare-config.entity';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpsertFareConfigDto } from './dto/upsert-fare-config.dto';
import { ReviewDriverDto, ReviewAction } from '../drivers/dto/review-driver.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,

    @InjectRepository(Driver)
    private driverRepository: Repository<Driver>,

    @InjectRepository(Trip)
    private tripRepository: Repository<Trip>,

    @InjectRepository(FareConfig)
    private fareConfigRepository: Repository<FareConfig>,
  ) {}

  // ─── Usuarios ─────────────────────────────────────────────────────────────────

  async listUsers(
    page = 1,
    limit = 50,
    status?: UserStatus,
  ): Promise<{ items: User[]; total: number; page: number; limit: number }> {
    const where = status ? { status } : {};
    const [items, total] = await this.userRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total, page, limit };
  }

  async getUser(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  async updateUserStatus(userId: string, dto: UpdateUserStatusDto): Promise<User> {
    await this.getUser(userId);
    await this.userRepository.update(userId, { status: dto.status });
    return this.getUser(userId);
  }

  // ─── Conductores independientes pendientes ────────────────────────────────────

  async listPendingIndependentDrivers(): Promise<Driver[]> {
    return this.driverRepository.find({
      where: {
        type: DriverType.INDEPENDENT,
        approvalStatus: ApprovalStatus.PENDING,
      },
      relations: ['user', 'vehicle', 'documents'],
      order: { createdAt: 'ASC' },
    });
  }

  async getDriver(driverId: string): Promise<Driver> {
    const driver = await this.driverRepository.findOne({
      where: { id: driverId },
      relations: ['user', 'vehicle', 'documents'],
    });
    if (!driver) throw new NotFoundException('Conductor no encontrado');
    return driver;
  }

  async reviewIndependentDriver(
    adminUserId: string,
    driverId: string,
    dto: ReviewDriverDto,
  ): Promise<Driver> {
    const driver = await this.getDriver(driverId);

    if (driver.type !== DriverType.INDEPENDENT) {
      throw new BadRequestException(
        'Este endpoint es solo para conductores independientes. Los conductores de remisera son aprobados por su remisera.',
      );
    }

    const statusMap: Record<ReviewAction, ApprovalStatus> = {
      [ReviewAction.APPROVE]: ApprovalStatus.APPROVED,
      [ReviewAction.REJECT]: ApprovalStatus.REJECTED,
      [ReviewAction.SUSPEND]: ApprovalStatus.SUSPENDED,
    };

    await this.driverRepository.update(driverId, {
      approvalStatus: statusMap[dto.action],
      approvedBy: adminUserId,
      approvedAt: new Date(),
      rejectionReason: dto.reason ?? undefined,
    });

    return this.getDriver(driverId);
  }

  // ─── Viajes del sistema ───────────────────────────────────────────────────────

  async listTrips(
    page = 1,
    limit = 50,
    status?: TripStatus,
  ) {
    const where = status ? { status } : {};
    const [items, total] = await this.tripRepository.findAndCount({
      where,
      relations: ['passenger', 'driver', 'driver.user', 'remisera'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total, page, limit };
  }

  async getTrip(tripId: string): Promise<Trip> {
    const trip = await this.tripRepository.findOne({
      where: { id: tripId },
      relations: ['passenger', 'driver', 'driver.user', 'remisera', 'locations'],
    });
    if (!trip) throw new NotFoundException('Viaje no encontrado');
    return trip;
  }

  // ─── Métricas del sistema ─────────────────────────────────────────────────────

  async getDashboardStats() {
    const [
      totalUsers,
      activeDrivers,
      pendingDrivers,
      tripsToday,
      tripsTotal,
    ] = await Promise.all([
      this.userRepository.count(),
      this.driverRepository.count({ where: { approvalStatus: ApprovalStatus.APPROVED } }),
      this.driverRepository.count({ where: { approvalStatus: ApprovalStatus.PENDING } }),
      this.tripRepository
        .createQueryBuilder('trip')
        .where('trip.created_at >= CURRENT_DATE')
        .andWhere('trip.status = :status', { status: TripStatus.COMPLETED })
        .getCount(),
      this.tripRepository.count({ where: { status: TripStatus.COMPLETED } }),
    ]);

    const revenueResult = await this.tripRepository
      .createQueryBuilder('trip')
      .select('COALESCE(SUM(payment.platform_fee), 0)', 'platform_revenue')
      .leftJoin('payments', 'payment', 'payment.trip_id = trip.id AND payment.status = \'completed\'')
      .where('trip.status = :status', { status: TripStatus.COMPLETED })
      .andWhere('trip.created_at >= NOW() - INTERVAL \'30 days\'')
      .getRawOne();

    return {
      totalUsers,
      activeDrivers,
      pendingDrivers,
      tripsToday,
      tripsTotal,
      platformRevenueLast30Days: parseFloat(revenueResult?.platform_revenue ?? '0'),
    };
  }

  // ─── Tarifas ──────────────────────────────────────────────────────────────────

  async getFareConfig(): Promise<FareConfig | null> {
    return this.fareConfigRepository.findOne({ where: { isActive: true } });
  }

  async upsertFareConfig(dto: UpsertFareConfigDto): Promise<FareConfig> {
    // Desactiva la config actual
    await this.fareConfigRepository.update({ isActive: true }, { isActive: false });

    const config = this.fareConfigRepository.create({
      name: 'default',
      baseFare: dto.baseFare,
      pricePerKm: dto.pricePerKm,
      pricePerMin: dto.pricePerMin,
      platformCommissionPct: dto.platformCommissionPct,
      isActive: true,
    });

    return this.fareConfigRepository.save(config);
  }
}
