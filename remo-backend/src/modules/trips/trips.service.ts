import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Trip, TripStatus, CancelledBy } from './entities/trip.entity';
import { TripLocation } from './entities/trip-location.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { FaresService } from '../fares/fares.service';
import { MatchingService } from './matching.service';
import { AppGateway } from '../../gateway/app.gateway';
import { CreateTripDto } from './dto/create-trip.dto';
import { EstimateTripDto } from './dto/estimate-trip.dto';
import { CancelTripDto } from './dto/cancel-trip.dto';

// Estados en los que el pasajero puede cancelar
const CANCELLABLE_BY_PASSENGER = [
  TripStatus.REQUESTED,
  TripStatus.SEARCHING,
  TripStatus.ASSIGNED,
  TripStatus.DRIVER_ARRIVING,
];

// Estados en los que el conductor puede cancelar
const CANCELLABLE_BY_DRIVER = [
  TripStatus.ASSIGNED,
  TripStatus.DRIVER_ARRIVING,
];

@Injectable()
export class TripsService {
  constructor(
    @InjectRepository(Trip)
    private tripRepository: Repository<Trip>,

    @InjectRepository(TripLocation)
    private locationRepository: Repository<TripLocation>,

    @InjectRepository(Driver)
    private driverRepository: Repository<Driver>,

    private faresService: FaresService,
    private matchingService: MatchingService,
    private gateway: AppGateway,
  ) {}

  // ─── Estimación previa ────────────────────────────────────────────────────────

  async estimate(dto: EstimateTripDto) {
    const distanceKm = haversineKm(dto.originLat, dto.originLng, dto.destinationLat, dto.destinationLng);
    const durationMin = Math.ceil((distanceKm / 30) * 60);
    return this.faresService.estimate(distanceKm, durationMin);
  }

  // ─── Crear viaje ──────────────────────────────────────────────────────────────

  async create(passengerId: string, dto: CreateTripDto): Promise<Trip> {
    // Verifica que el pasajero no tenga un viaje activo
    const active = await this.tripRepository.findOne({
      where: [
        { passengerId, status: TripStatus.REQUESTED },
        { passengerId, status: TripStatus.SEARCHING },
        { passengerId, status: TripStatus.ASSIGNED },
        { passengerId, status: TripStatus.DRIVER_ARRIVING },
        { passengerId, status: TripStatus.IN_PROGRESS },
      ],
    });

    if (active) {
      throw new BadRequestException('Ya tenés un viaje activo');
    }

    const distanceKm = haversineKm(dto.originLat, dto.originLng, dto.destinationLat, dto.destinationLng);
    const durationMin = Math.ceil((distanceKm / 30) * 60);
    const estimate = await this.faresService.estimate(distanceKm, durationMin);

    const originLng = Number(dto.originLng);
    const originLat = Number(dto.originLat);
    const destLng = Number(dto.destinationLng);
    const destLat = Number(dto.destinationLat);

    const result = await this.tripRepository
      .createQueryBuilder()
      .insert()
      .into(Trip)
      .values({
        passengerId,
        originAddress: dto.originAddress,
        originCoords: () => `ST_SetSRID(ST_MakePoint(${originLng}, ${originLat}), 4326)`,
        destinationAddress: dto.destinationAddress,
        destinationCoords: () => `ST_SetSRID(ST_MakePoint(${destLng}, ${destLat}), 4326)`,
        paymentMethod: dto.paymentMethod,
        estimatedDistanceKm: distanceKm,
        estimatedDurationMin: durationMin,
        estimatedPrice: estimate.price,
        status: TripStatus.REQUESTED,
      })
      .returning('id')
      .execute();

    const trip = await this.tripRepository.findOneOrFail({ where: { id: result.raw[0].id } });

    // Inicia el matching en background (no bloquea la respuesta HTTP)
    setImmediate(() => this.matchingService.startMatching(trip.id));

    return trip;
  }

  // ─── Acciones del conductor ───────────────────────────────────────────────────

  async driverArrived(driverId: string, tripId: string): Promise<Trip> {
    const trip = await this.getAndVerifyDriver(tripId, driverId, TripStatus.ASSIGNED);

    await this.tripRepository.update(tripId, {
      status: TripStatus.DRIVER_ARRIVING,
      driverArrivedAt: new Date(),
    });

    this.gateway.emitToUser(trip.passengerId, 'trip:driver_arrived', { tripId });
    this.gateway.emitToTrip(tripId, 'trip:driver_arrived', { tripId });

    return this.findById(tripId);
  }

  async startTrip(driverId: string, tripId: string): Promise<Trip> {
    const trip = await this.getAndVerifyDriver(tripId, driverId, TripStatus.DRIVER_ARRIVING);

    await this.tripRepository.update(tripId, {
      status: TripStatus.IN_PROGRESS,
      startedAt: new Date(),
    });

    this.gateway.emitToTrip(tripId, 'trip:started', { tripId });

    return this.findById(tripId);
  }

  async completeTrip(driverId: string, tripId: string): Promise<Trip> {
    const trip = await this.getAndVerifyDriver(tripId, driverId, TripStatus.IN_PROGRESS);

    const durationMin = Math.ceil(
      (Date.now() - trip.startedAt!.getTime()) / 60000,
    );

    const [oLat, oLng] = this.extractCoords(trip.originCoords as any);
    const [dLat, dLng] = this.extractCoords(trip.destinationCoords as any);
    const distanceKm = haversineKm(oLat, oLng, dLat, dLng);

    const estimate = await this.faresService.estimate(distanceKm, durationMin);

    await this.tripRepository.update(tripId, {
      status: TripStatus.COMPLETED,
      completedAt: new Date(),
      realDistanceKm: distanceKm,
      realDurationMin: durationMin,
      finalPrice: estimate.price,
    });

    // Libera al conductor para nuevos viajes
    await this.matchingService.releaseDriver(driverId);

    const completed = await this.findById(tripId);

    this.gateway.emitToTrip(tripId, 'trip:completed', {
      tripId,
      finalPrice: completed.finalPrice,
      paymentMethod: completed.paymentMethod,
    });

    return completed;
  }

  // ─── Cancelación ─────────────────────────────────────────────────────────────

  async cancelByPassenger(passengerId: string, tripId: string, dto: CancelTripDto): Promise<Trip> {
    const trip = await this.findById(tripId);

    if (trip.passengerId !== passengerId) {
      throw new ForbiddenException('No podés cancelar este viaje');
    }

    if (!CANCELLABLE_BY_PASSENGER.includes(trip.status)) {
      throw new BadRequestException(`No podés cancelar un viaje en estado ${trip.status}`);
    }

    // Si estaba en matching, interrumpe la búsqueda
    if (trip.status === TripStatus.SEARCHING) {
      await this.matchingService.cancelMatching(tripId, passengerId);
    }

    if (trip.driverId) {
      await this.matchingService.releaseDriver(trip.driverId);
      this.gateway.emitToDriver(trip.driverId, 'trip:passenger_cancelled', { tripId });
    }

    await this.tripRepository.update(tripId, {
      status: TripStatus.CANCELLED,
      cancelledAt: new Date(),
      cancelledBy: CancelledBy.PASSENGER,
      cancellationReason: dto.reason,
    });

    return this.findById(tripId);
  }

  async cancelByDriver(driverId: string, tripId: string, dto: CancelTripDto): Promise<Trip> {
    const trip = await this.findById(tripId);

    if (trip.driverId !== driverId) {
      throw new ForbiddenException('No podés cancelar este viaje');
    }

    if (!CANCELLABLE_BY_DRIVER.includes(trip.status)) {
      throw new BadRequestException(`No podés cancelar un viaje en estado ${trip.status}`);
    }

    await this.matchingService.releaseDriver(driverId);

    await this.tripRepository.update(tripId, {
      status: TripStatus.CANCELLED,
      cancelledAt: new Date(),
      cancelledBy: CancelledBy.DRIVER,
      cancellationReason: dto.reason,
    });

    this.gateway.emitToUser(trip.passengerId, 'trip:cancelled', {
      tripId,
      reason: 'driver_cancelled',
    });

    return this.findById(tripId);
  }

  // ─── Consultas ────────────────────────────────────────────────────────────────

  async findById(tripId: string): Promise<Trip> {
    const trip = await this.tripRepository.findOne({
      where: { id: tripId },
      relations: ['passenger', 'driver', 'driver.user', 'vehicle', 'remisera'],
    });
    if (!trip) throw new NotFoundException('Viaje no encontrado');
    return trip;
  }

  async getHistory(userId: string, asDriver: boolean, page = 1, limit = 20) {
    const where = asDriver ? { driverId: userId } : { passengerId: userId };

    const [items, total] = await this.tripRepository.findAndCount({
      where: { ...where, status: TripStatus.COMPLETED },
      order: { completedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { items, total, page, limit };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  private async getAndVerifyDriver(
    tripId: string,
    driverId: string,
    expectedStatus: TripStatus,
  ): Promise<Trip> {
    const trip = await this.findById(tripId);

    if (trip.driverId !== driverId) {
      throw new ForbiddenException('No sos el conductor asignado a este viaje');
    }

    if (trip.status !== expectedStatus) {
      throw new BadRequestException(`Estado inválido: el viaje está en ${trip.status}`);
    }

    return trip;
  }

  // Dev: asigna directamente el conductor de prueba sin esperar socket
  async devAcceptTrip(tripId: string, driverId: string): Promise<Trip> {
    const driver = await this.driverRepository.findOne({
      where: { id: driverId },
      relations: ['user', 'vehicle'],
    });
    if (!driver) throw new NotFoundException('Conductor de prueba no encontrado');

    const vehicle = driver.vehicle;

    await this.tripRepository.update(tripId, {
      driverId,
      vehicleId: vehicle?.id,
      status: TripStatus.ASSIGNED,
      assignedAt: new Date(),
    });

    const trip = await this.findById(tripId);

    this.gateway.emitToUser(trip.passengerId, 'trip:driver_assigned', {
      tripId,
      driver: {
        id: driver.user.id,
        name: driver.user.name,
        rating: driver.user.ratingAvg,
        lat: -24.7821,
        lng: -65.4232,
      },
      vehicle: {
        plate: vehicle?.plate,
        brand: vehicle?.brand,
        model: vehicle?.model,
        color: vehicle?.color,
      },
      etaMinutes: 5,
    });

    return trip;
  }

  private extractCoords(wkt: string): [number, number] {
    if (typeof wkt === 'string' && wkt.startsWith('POINT')) {
      const m = wkt.match(/POINT\(([^ ]+) ([^ )]+)\)/);
      return [parseFloat(m![2]), parseFloat(m![1])];
    }
    const c = (wkt as any)?.coordinates ?? [0, 0];
    return [c[1], c[0]];
  }
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
