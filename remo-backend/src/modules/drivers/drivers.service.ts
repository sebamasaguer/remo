import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../redis/redis.module';
import { Driver, ApprovalStatus, DriverType } from './entities/driver.entity';
import { Vehicle } from './entities/vehicle.entity';
import { DriverDocument, DocumentStatus } from './entities/driver-document.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { RegisterDriverDto } from './dto/register-driver.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { ReviewDriverDto, ReviewAction } from './dto/review-driver.dto';

const LOCATION_TTL = 30; // segundos — si no renueva, se considera offline

@Injectable()
export class DriversService {
  constructor(
    @InjectRepository(Driver)
    private driverRepository: Repository<Driver>,

    @InjectRepository(Vehicle)
    private vehicleRepository: Repository<Vehicle>,

    @InjectRepository(DriverDocument)
    private documentRepository: Repository<DriverDocument>,

    @InjectRepository(User)
    private userRepository: Repository<User>,

    @Inject(REDIS_CLIENT)
    private redis: Redis,
  ) {}

  // ─── Registro ────────────────────────────────────────────────────────────────

  async register(userId: string, dto: RegisterDriverDto): Promise<Driver> {
    const existing = await this.driverRepository.findOne({ where: { userId } });
    if (existing) {
      throw new ConflictException('Ya estás registrado como conductor');
    }

    if (dto.type === DriverType.REMISERA && !dto.remiseraId) {
      throw new BadRequestException('Debés seleccionar una remisera');
    }

    const plateExists = await this.vehicleRepository.findOne({ where: { plate: dto.plate } });
    if (plateExists) {
      throw new ConflictException('Ya existe un vehículo registrado con esa patente');
    }

    // Actualiza el rol del usuario
    await this.userRepository.update(userId, { role: UserRole.DRIVER });

    const driver = this.driverRepository.create({
      userId,
      type: dto.type,
      remeseraId: dto.remiseraId ?? undefined,
      approvalStatus: ApprovalStatus.PENDING,
    });
    await this.driverRepository.save(driver);

    const vehicle = this.vehicleRepository.create({
      driverId: driver.id,
      plate: dto.plate.toUpperCase(),
      brand: dto.brand,
      model: dto.model,
      year: parseInt(dto.year, 10),
      color: dto.color,
    });
    await this.vehicleRepository.save(vehicle);

    return this.findByUserId(userId);
  }

  // ─── Perfil ───────────────────────────────────────────────────────────────────

  async findByUserId(userId: string): Promise<Driver> {
    const driver = await this.driverRepository.findOne({
      where: { userId },
      relations: ['user', 'vehicle', 'documents', 'remisera'],
    });

    if (!driver) throw new NotFoundException('Conductor no encontrado');
    return driver;
  }

  async findById(driverId: string): Promise<Driver> {
    const driver = await this.driverRepository.findOne({
      where: { id: driverId },
      relations: ['user', 'vehicle', 'documents', 'remisera'],
    });

    if (!driver) throw new NotFoundException('Conductor no encontrado');
    return driver;
  }

  // ─── Vehículo ─────────────────────────────────────────────────────────────────

  async updateVehicle(userId: string, dto: UpdateVehicleDto): Promise<Vehicle> {
    const driver = await this.findByUserId(userId);

    await this.vehicleRepository.update(driver.vehicle.id, {
      brand: dto.brand,
      model: dto.model,
      year: dto.year ? parseInt(dto.year, 10) : undefined,
      color: dto.color,
      photoUrl: dto.photoUrl,
    });

    return this.vehicleRepository.findOne({ where: { driverId: driver.id } }) as Promise<Vehicle>;
  }

  // ─── Ubicación y estado ───────────────────────────────────────────────────────

  async updateLocation(userId: string, dto: UpdateLocationDto): Promise<void> {
    const driver = await this.findByUserId(userId);

    if (driver.approvalStatus !== ApprovalStatus.APPROVED) {
      throw new ForbiddenException('Tu cuenta aún no está aprobada');
    }

    // Actualiza en DB con PostGIS
    await this.driverRepository
      .createQueryBuilder()
      .update(Driver)
      .set({
        lastLocation: () =>
          `ST_SetSRID(ST_MakePoint(${dto.lng}, ${dto.lat}), 4326)`,
        lastSeenAt: new Date(),
      })
      .where('id = :id', { id: driver.id })
      .execute();

    // Guarda en Redis con TTL para saber que está activo
    await this.redis.set(
      `driver:online:${driver.id}`,
      JSON.stringify({ lat: dto.lat, lng: dto.lng, updatedAt: Date.now() }),
      'EX',
      LOCATION_TTL,
    );
  }

  async updateOnlineStatus(userId: string, dto: UpdateStatusDto): Promise<{ isOnline: boolean }> {
    const driver = await this.findByUserId(userId);

    if (driver.approvalStatus !== ApprovalStatus.APPROVED) {
      throw new ForbiddenException('Tu cuenta aún no está aprobada');
    }

    await this.driverRepository.update(driver.id, { isOnline: dto.isOnline });

    if (!dto.isOnline) {
      await this.redis.del(`driver:online:${driver.id}`);
    }

    return { isOnline: dto.isOnline };
  }

  // ─── Documentos ───────────────────────────────────────────────────────────────

  async uploadDocument(userId: string, dto: UploadDocumentDto): Promise<DriverDocument> {
    const driver = await this.findByUserId(userId);

    // Si ya existe un documento de ese tipo, lo reemplaza
    const existing = await this.documentRepository.findOne({
      where: { driverId: driver.id, type: dto.type },
    });

    if (existing) {
      await this.documentRepository.update(existing.id, {
        fileUrl: dto.fileUrl,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        status: DocumentStatus.PENDING,
        reviewedBy: undefined,
        reviewedAt: undefined,
      });
      return this.documentRepository.findOne({ where: { id: existing.id } }) as Promise<DriverDocument>;
    }

    const doc = this.documentRepository.create({
      driverId: driver.id,
      type: dto.type,
      fileUrl: dto.fileUrl,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      status: DocumentStatus.PENDING,
    });

    return this.documentRepository.save(doc);
  }

  async getDocuments(userId: string): Promise<DriverDocument[]> {
    const driver = await this.findByUserId(userId);
    return this.documentRepository.find({ where: { driverId: driver.id } });
  }

  // ─── Aprobación (admin / remisera) ───────────────────────────────────────────

  async reviewDriver(
    driverId: string,
    reviewerUserId: string,
    dto: ReviewDriverDto,
  ): Promise<Driver> {
    const driver = await this.findById(driverId);

    if (dto.action === ReviewAction.REJECT && !dto.reason) {
      throw new BadRequestException('Debés indicar el motivo del rechazo');
    }

    if (dto.action === ReviewAction.SUSPEND && !dto.reason) {
      throw new BadRequestException('Debés indicar el motivo de la suspensión');
    }

    const statusMap: Record<ReviewAction, ApprovalStatus> = {
      [ReviewAction.APPROVE]: ApprovalStatus.APPROVED,
      [ReviewAction.REJECT]: ApprovalStatus.REJECTED,
      [ReviewAction.SUSPEND]: ApprovalStatus.SUSPENDED,
    };

    await this.driverRepository.update(driver.id, {
      approvalStatus: statusMap[dto.action],
      approvedBy: reviewerUserId,
      approvedAt: new Date(),
      rejectionReason: dto.reason ?? undefined,
    });

    // Si se suspende mientras está online, lo desconecta
    if (dto.action === ReviewAction.SUSPEND) {
      await this.driverRepository.update(driver.id, { isOnline: false });
      await this.redis.del(`driver:online:${driver.id}`);
    }

    return this.findById(driverId);
  }

  // ─── Ganancias ────────────────────────────────────────────────────────────────

  async getEarnings(userId: string, period: 'day' | 'week' | 'month' = 'day') {
    const driver = await this.findByUserId(userId);

    const intervals: Record<string, string> = {
      day: '1 day',
      week: '7 days',
      month: '30 days',
    };

    const result = await this.driverRepository
      .createQueryBuilder('driver')
      .select([
        'COUNT(trip.id) AS total_trips',
        'COALESCE(SUM(payment.driver_earnings), 0) AS total_earnings',
        'COALESCE(SUM(CASE WHEN payment.method = \'cash\' THEN payment.driver_earnings ELSE 0 END), 0) AS cash_earnings',
        'COALESCE(SUM(CASE WHEN payment.method = \'mercado_pago\' THEN payment.driver_earnings ELSE 0 END), 0) AS digital_earnings',
      ])
      .innerJoin('trips', 'trip', 'trip.driver_id = :driverId AND trip.status = \'completed\'', { driverId: driver.id })
      .innerJoin('payments', 'payment', 'payment.trip_id = trip.id')
      .where(`trip.completed_at >= NOW() - INTERVAL '${intervals[period]}'`)
      .getRawOne();

    return {
      period,
      totalTrips: parseInt(result.total_trips ?? '0', 10),
      totalEarnings: parseFloat(result.total_earnings ?? '0'),
      cashEarnings: parseFloat(result.cash_earnings ?? '0'),
      digitalEarnings: parseFloat(result.digital_earnings ?? '0'),
    };
  }

  // ─── Conductores pendientes (para admin) ─────────────────────────────────────

  async findPending(): Promise<Driver[]> {
    return this.driverRepository.find({
      where: { approvalStatus: ApprovalStatus.PENDING, type: DriverType.INDEPENDENT },
      relations: ['user', 'vehicle', 'documents'],
      order: { createdAt: 'ASC' },
    });
  }
}
