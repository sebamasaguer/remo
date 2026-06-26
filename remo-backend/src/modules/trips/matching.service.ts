import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../redis/redis.module';
import { Trip, TripStatus } from './entities/trip.entity';
import { Driver, ApprovalStatus } from '../drivers/entities/driver.entity';
import { AppGateway } from '../../gateway/app.gateway';

const OFFER_TTL = 15;
const MAX_RADIUS_M = 5000;
const MAX_CANDIDATES = 10;
const POLL_INTERVAL_MS = 500;

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);

  constructor(
    @InjectRepository(Trip)
    private tripRepository: Repository<Trip>,

    @InjectRepository(Driver)
    private driverRepository: Repository<Driver>,

    @Inject(REDIS_CLIENT)
    private redis: Redis,

    private gateway: AppGateway,
    private dataSource: DataSource,
  ) {
    // Registra este servicio en el gateway para manejar accept/reject
    this.gateway.setMatchingService(this);
  }

  // ─── Punto de entrada ─────────────────────────────────────────────────────────

  async startMatching(tripId: string): Promise<void> {
    const trip = await this.tripRepository.findOne({
      where: { id: tripId },
      relations: ['passenger'],
    });
    if (!trip) return;

    await this.tripRepository.update(tripId, { status: TripStatus.SEARCHING });
    this.gateway.emitToUser(trip.passengerId, 'trip:searching', { tripId });

    const candidates = await this.findNearbyDrivers(trip);

    if (candidates.length === 0) {
      await this.cancelWithNoDrivers(trip);
      return;
    }

    this.logger.log(`${candidates.length} candidatos para viaje ${tripId}`);
    await this.offerToNext(trip, candidates, 0);
  }

  // ─── Búsqueda de conductores cercanos ─────────────────────────────────────────

  private async findNearbyDrivers(trip: Trip): Promise<Driver[]> {
    const raw = trip.originCoords as unknown as string;

    // Extrae coordenadas del WKT o del objeto GeoJSON según cómo las devuelva TypeORM
    let lat: number;
    let lng: number;

    if (typeof raw === 'string' && raw.startsWith('POINT')) {
      // Formato WKT: "POINT(lng lat)"
      const match = raw.match(/POINT\(([^ ]+) ([^ )]+)\)/);
      lng = parseFloat(match![1]);
      lat = parseFloat(match![2]);
    } else {
      // Asume que ya tenemos los valores del DTO originales guardados en el trip
      const coords = raw as any;
      lng = coords?.coordinates?.[0] ?? 0;
      lat = coords?.coordinates?.[1] ?? 0;
    }

    const candidates = await this.driverRepository
      .createQueryBuilder('driver')
      .innerJoinAndSelect('driver.user', 'user')
      .innerJoinAndSelect('driver.vehicle', 'vehicle')
      .where('driver.is_online = true')
      .andWhere('driver.approval_status = :status', { status: ApprovalStatus.APPROVED })
      .andWhere(
        `ST_DWithin(driver.last_location::geography,
          ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, :radius)`,
        { lat, lng, radius: MAX_RADIUS_M },
      )
      .orderBy(
        `ST_Distance(driver.last_location::geography,
          ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography)`,
        'ASC',
      )
      .setParameters({ lat, lng })
      .limit(MAX_CANDIDATES)
      .getMany();

    const available: Driver[] = [];
    for (const d of candidates) {
      const busy = await this.redis.exists(`driver:busy:${d.id}`);
      if (!busy) available.push(d);
    }
    return available;
  }

  // ─── Loop secuencial de oferta ────────────────────────────────────────────────

  private async offerToNext(trip: Trip, candidates: Driver[], index: number): Promise<void> {
    if (index >= candidates.length) {
      await this.cancelWithNoDrivers(trip);
      return;
    }

    const current = await this.tripRepository.findOne({ where: { id: trip.id } });
    if (!current || current.status === TripStatus.CANCELLED) return;

    const driver = candidates[index];
    this.logger.log(`Oferta ${index + 1}/${candidates.length} → conductor ${driver.id}`);

    await this.redis.set(`trip:matching:${trip.id}`, driver.id, 'EX', OFFER_TTL + 2);
    await this.redis.set(`trip:offer:${trip.id}:${driver.id}`, '1', 'EX', OFFER_TTL);

    const eta = this.calcEtaMinutes(driver, trip);

    this.gateway.emitToDriver(driver.id, 'trip:new_request', {
      tripId: trip.id,
      passenger: { name: trip.passenger.name, rating: trip.passenger.ratingAvg },
      originAddress: trip.originAddress,
      destinationAddress: trip.destinationAddress,
      estimatedPrice: trip.estimatedPrice,
      estimatedDistanceKm: trip.estimatedDistanceKm,
      paymentMethod: trip.paymentMethod,
      etaToPassengerMin: eta,
      expiresInSeconds: OFFER_TTL,
    });

    const response = await this.waitForResponse(trip.id, driver.id);

    if (response === 'accepted') {
      await this.assignDriver(trip, driver);
    } else {
      await this.redis.del(`trip:offer:${trip.id}:${driver.id}`);
      await this.offerToNext(trip, candidates, index + 1);
    }
  }

  // ─── Espera la respuesta (polling Redis) ──────────────────────────────────────

  private waitForResponse(
    tripId: string,
    driverId: string,
  ): Promise<'accepted' | 'rejected' | 'timeout'> {
    return new Promise((resolve) => {
      const key = `trip:offer:${tripId}:${driverId}`;
      let elapsed = 0;

      const interval = setInterval(async () => {
        elapsed += POLL_INTERVAL_MS;
        const value = await this.redis.get(key);

        if (value === 'accepted') {
          clearInterval(interval);
          resolve('accepted');
          return;
        }

        if (value === null && elapsed < OFFER_TTL * 1000) {
          clearInterval(interval);
          resolve('rejected');
          return;
        }

        if (elapsed >= OFFER_TTL * 1000) {
          clearInterval(interval);
          await this.redis.del(key);
          resolve('timeout');
        }
      }, POLL_INTERVAL_MS);
    });
  }

  // ─── Asignación ───────────────────────────────────────────────────────────────

  private async assignDriver(trip: Trip, driver: Driver): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.update(Trip, trip.id, {
        driverId: driver.id,
        vehicleId: driver.vehicle.id,
        remiseraId: driver.remeseraId ?? undefined,
        status: TripStatus.ASSIGNED,
        assignedAt: new Date(),
      });
    });

    await this.redis.set(`driver:busy:${driver.id}`, '1');
    await this.redis.del(`trip:matching:${trip.id}`);
    await this.redis.del(`trip:offer:${trip.id}:${driver.id}`);

    const eta = this.calcEtaMinutes(driver, trip);

    // Une al conductor al canal del viaje
    this.gateway.emitToDriver(driver.id, 'trip:assigned_to_you', {
      tripId: trip.id,
      passenger: { name: trip.passenger.name, rating: trip.passenger.ratingAvg },
      originAddress: trip.originAddress,
      destinationAddress: trip.destinationAddress,
    });

    // Notifica al pasajero
    this.gateway.emitToUser(trip.passengerId, 'trip:driver_assigned', {
      tripId: trip.id,
      driver: {
        id: driver.id,
        name: driver.user.name,
        rating: driver.user.ratingAvg,
        photo: driver.user.avatarUrl,
      },
      vehicle: {
        plate: driver.vehicle.plate,
        brand: driver.vehicle.brand,
        model: driver.vehicle.model,
        color: driver.vehicle.color,
        photo: driver.vehicle.photoUrl,
      },
      etaMinutes: eta,
    });

    this.logger.log(`Viaje ${trip.id} asignado al conductor ${driver.id}`);
  }

  // ─── Sin conductores ──────────────────────────────────────────────────────────

  private async cancelWithNoDrivers(trip: Trip): Promise<void> {
    await this.tripRepository.update(trip.id, {
      status: TripStatus.CANCELLED,
      cancelledAt: new Date(),
      cancelledBy: 'system' as any,
      cancellationReason: 'no_drivers_available',
    });

    this.gateway.emitToUser(trip.passengerId, 'trip:cancelled', {
      tripId: trip.id,
      reason: 'no_drivers_available',
    });

    this.logger.warn(`Viaje ${trip.id} cancelado: sin conductores`);
  }

  // ─── API pública para el Gateway ─────────────────────────────────────────────

  async driverAccepted(tripId: string, driverId: string): Promise<void> {
    const key = `trip:offer:${tripId}:${driverId}`;
    const exists = await this.redis.exists(key);

    if (!exists) {
      this.gateway.emitToDriver(driverId, 'trip:offer_expired', { tripId });
      return;
    }

    await this.redis.set(key, 'accepted', 'KEEPTTL');
  }

  async driverRejected(tripId: string, driverId: string): Promise<void> {
    await this.redis.del(`trip:offer:${tripId}:${driverId}`);
  }

  async cancelMatching(tripId: string, passengerId: string): Promise<void> {
    const activeDriverId = await this.redis.get(`trip:matching:${tripId}`);

    if (activeDriverId) {
      await this.redis.del(`trip:offer:${tripId}:${activeDriverId}`);
      this.gateway.emitToDriver(activeDriverId, 'trip:passenger_cancelled', { tripId });
    }

    await this.redis.del(`trip:matching:${tripId}`);
    this.gateway.emitToUser(passengerId, 'trip:cancelled', { tripId, reason: 'passenger_cancelled' });
  }

  async releaseDriver(driverId: string): Promise<void> {
    await this.redis.del(`driver:busy:${driverId}`);
  }

  // ─── ETA estimado ─────────────────────────────────────────────────────────────

  private calcEtaMinutes(driver: Driver, trip: Trip): number {
    // Haversine simple — en producción reemplazar con Google Maps Distance Matrix
    if (!driver.lastLocation) return 5;

    const loc = driver.lastLocation as unknown as any;
    let dLng: number, dLat: number;

    if (typeof loc === 'string' && loc.startsWith('POINT')) {
      const m = loc.match(/POINT\(([^ ]+) ([^ )]+)\)/);
      dLng = parseFloat(m![1]);
      dLat = parseFloat(m![2]);
    } else {
      dLng = loc?.coordinates?.[0] ?? 0;
      dLat = loc?.coordinates?.[1] ?? 0;
    }

    const orig = trip.originCoords as unknown as any;
    let oLng: number, oLat: number;

    if (typeof orig === 'string' && orig.startsWith('POINT')) {
      const m = orig.match(/POINT\(([^ ]+) ([^ )]+)\)/);
      oLng = parseFloat(m![1]);
      oLat = parseFloat(m![2]);
    } else {
      oLng = orig?.coordinates?.[0] ?? 0;
      oLat = orig?.coordinates?.[1] ?? 0;
    }

    const km = haversineKm(dLat, dLng, oLat, oLng);
    return Math.max(1, Math.ceil((km / 30) * 60));
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
