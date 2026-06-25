# REMO — MatchingService en detalle

## Responsabilidades

1. Encontrar los conductores disponibles más cercanos al origen del viaje
2. Ofrecerles el viaje de forma secuencial (uno a la vez)
3. Manejar aceptación, rechazo y timeout (15 segundos por conductor)
4. Asignar el viaje al primer conductor que acepta
5. Notificar al pasajero en cada cambio de estado
6. Marcar el viaje como sin conductor si ninguno acepta

---

## Dependencias del servicio

```
MatchingService
    ├── TypeORM → TripRepository       -- actualiza estado del viaje
    ├── TypeORM → DriverRepository     -- consulta conductores disponibles (PostGIS)
    ├── Redis (ioredis)                -- estado online de conductores + locks
    ├── AppGateway (Socket.io)         -- emite eventos en tiempo real
    └── NotificationsService           -- envía push notifications (fallback)
```

---

## Claves en Redis

```
driver:online:{driverId}          -- HASH con { lat, lng, updatedAt }  TTL: 30s
                                  -- el conductor lo renueva cada 5s mientras está online

driver:busy:{driverId}            -- STRING vacío, TTL: duración del viaje
                                  -- evita que reciba nuevas solicitudes mientras está en un viaje

trip:offer:{tripId}:{driverId}    -- STRING vacío, TTL: 15s
                                  -- ventana de tiempo para que el conductor responda

trip:matching:{tripId}            -- STRING con el driverId que tiene la oferta activa
                                  -- permite cancelar la oferta si el pasajero cancela
```

---

## Código fuente

### src/modules/trips/matching.service.ts

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';

import { Trip, TripStatus } from './entities/trip.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { AppGateway } from '../../gateway/app.gateway';
import { NotificationsService } from '../notifications/notifications.service';

const OFFER_TTL_SECONDS = 15;
const MAX_SEARCH_RADIUS_KM = 5;
const MAX_CANDIDATES = 10;

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);

  constructor(
    @InjectRepository(Trip)
    private tripRepository: Repository<Trip>,

    @InjectRepository(Driver)
    private driverRepository: Repository<Driver>,

    @InjectRedis()
    private redis: Redis,

    private gateway: AppGateway,
    private notificationsService: NotificationsService,

    private dataSource: DataSource,
  ) {}

  // ─── Punto de entrada ────────────────────────────────────────────────────────

  async startMatching(tripId: string): Promise<void> {
    this.logger.log(`Iniciando matching para viaje ${tripId}`);

    const trip = await this.tripRepository.findOne({
      where: { id: tripId },
      relations: ['passenger'],
    });

    if (!trip) {
      this.logger.error(`Viaje ${tripId} no encontrado`);
      return;
    }

    await this.tripRepository.update(tripId, { status: TripStatus.SEARCHING });
    this.gateway.emitToTrip(tripId, 'trip:searching', {});

    const candidates = await this.findNearbyDrivers(trip);

    if (candidates.length === 0) {
      this.logger.warn(`Sin conductores disponibles para viaje ${tripId}`);
      await this.cancelWithNoDrivers(trip);
      return;
    }

    this.logger.log(`${candidates.length} candidatos encontrados para viaje ${tripId}`);
    await this.offerToNextDriver(trip, candidates, 0);
  }

  // ─── Búsqueda de conductores cercanos ────────────────────────────────────────

  private async findNearbyDrivers(trip: Trip): Promise<Driver[]> {
    const { origin_coords } = trip;

    /*
     * Consulta PostGIS:
     * - Solo conductores online, aprobados y sin viaje activo
     * - Dentro del radio máximo de búsqueda
     * - Ordenados por distancia ascendente
     * - Limitados a MAX_CANDIDATES
     *
     * ST_DWithin usa índice GIST → O(log n), muy rápido aunque haya miles de conductores
     */
    const candidates = await this.driverRepository
      .createQueryBuilder('driver')
      .innerJoinAndSelect('driver.user', 'user')
      .innerJoinAndSelect('driver.vehicle', 'vehicle')
      .where('driver.is_online = true')
      .andWhere('driver.approval_status = :status', { status: 'approved' })
      .andWhere(
        `ST_DWithin(
          driver.last_location::geography,
          ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
          :radius
        )`,
        {
          lat: origin_coords.coordinates[1],
          lng: origin_coords.coordinates[0],
          radius: MAX_SEARCH_RADIUS_KM * 1000, // metros
        },
      )
      .orderBy(
        `ST_Distance(
          driver.last_location::geography,
          ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
        )`,
        'ASC',
      )
      .limit(MAX_CANDIDATES)
      .getMany();

    // Filtra los que están ocupados en Redis (más actualizado que la DB)
    const available: Driver[] = [];

    for (const driver of candidates) {
      const isBusy = await this.redis.exists(`driver:busy:${driver.id}`);
      if (!isBusy) {
        available.push(driver);
      }
    }

    return available;
  }

  // ─── Oferta secuencial ────────────────────────────────────────────────────────

  private async offerToNextDriver(
    trip: Trip,
    candidates: Driver[],
    index: number,
  ): Promise<void> {
    // Sin más candidatos → nadie aceptó
    if (index >= candidates.length) {
      this.logger.warn(`Ningún conductor aceptó el viaje ${trip.id}`);
      await this.cancelWithNoDrivers(trip);
      return;
    }

    // Verifica que el viaje siga activo (el pasajero puede haber cancelado)
    const current = await this.tripRepository.findOne({ where: { id: trip.id } });
    if (!current || current.status === TripStatus.CANCELLED) {
      this.logger.log(`Viaje ${trip.id} cancelado durante el matching`);
      return;
    }

    const driver = candidates[index];
    this.logger.log(`Ofreciendo viaje ${trip.id} al conductor ${driver.id} (${index + 1}/${candidates.length})`);

    // Guarda quién tiene la oferta activa (para poder cancelarla desde fuera)
    await this.redis.set(`trip:matching:${trip.id}`, driver.id, 'EX', OFFER_TTL_SECONDS + 2);

    // Crea la ventana de tiempo de la oferta
    await this.redis.set(
      `trip:offer:${trip.id}:${driver.id}`,
      '1',
      'EX',
      OFFER_TTL_SECONDS,
    );

    // Calcula ETA aproximado para mostrar al conductor
    const etaMinutes = await this.estimateEta(driver, trip);

    // Emite la oferta al conductor via WebSocket
    this.gateway.emitToDriver(driver.id, 'trip:new_request', {
      tripId: trip.id,
      passenger: {
        name: trip.passenger.name,
        rating: trip.passenger.rating_avg,
      },
      origin: {
        address: trip.origin_address,
        coords: trip.origin_coords,
      },
      destination: {
        address: trip.destination_address,
        coords: trip.destination_coords,
      },
      estimatedPrice: trip.estimated_price,
      estimatedDistance: trip.estimated_distance_km,
      paymentMethod: trip.payment_method,
      etaToPassenger: etaMinutes,
      expiresInSeconds: OFFER_TTL_SECONDS,
    });

    // También envía push notification por si el conductor tiene la app en background
    await this.notificationsService.sendToDriver(driver.id, {
      title: 'Nuevo viaje disponible',
      body: `${trip.origin_address} → ${trip.destination_address} · $${trip.estimated_price}`,
      data: { type: 'trip_request', tripId: trip.id },
    });

    // Espera la respuesta del conductor durante OFFER_TTL_SECONDS
    const response = await this.waitForDriverResponse(trip.id, driver.id);

    if (response === 'accepted') {
      await this.assignDriver(trip, driver);
    } else {
      // Rechazó o venció el tiempo → limpia y pasa al siguiente
      this.logger.log(
        `Conductor ${driver.id} ${response === 'rejected' ? 'rechazó' : 'no respondió'} el viaje ${trip.id}`,
      );
      await this.redis.del(`trip:offer:${trip.id}:${driver.id}`);
      await this.offerToNextDriver(trip, candidates, index + 1);
    }
  }

  // ─── Espera la respuesta del conductor ───────────────────────────────────────

  private waitForDriverResponse(
    tripId: string,
    driverId: string,
  ): Promise<'accepted' | 'rejected' | 'timeout'> {
    return new Promise((resolve) => {
      const offerKey = `trip:offer:${tripId}:${driverId}`;
      const checkInterval = 500; // ms
      let elapsed = 0;

      /*
       * Polling ligero sobre Redis cada 500ms.
       * La clave tiene TTL de 15s:
       *   - Si se elimina antes del TTL → el conductor respondió (accept/reject)
       *   - Si expira sola → timeout
       *
       * La respuesta real llega por WebSocket (gateway) y escribe en Redis:
       *   - Aceptó: SET trip:offer:{id}:{driverId} "accepted"
       *   - Rechazó: DEL trip:offer:{id}:{driverId}
       */
      const interval = setInterval(async () => {
        elapsed += checkInterval;

        const value = await this.redis.get(offerKey);

        if (value === 'accepted') {
          clearInterval(interval);
          resolve('accepted');
        } else if (value === null) {
          // La clave desapareció antes del TTL → rechazó explícitamente
          if (elapsed < OFFER_TTL_SECONDS * 1000) {
            clearInterval(interval);
            resolve('rejected');
          }
        }

        if (elapsed >= OFFER_TTL_SECONDS * 1000) {
          clearInterval(interval);
          await this.redis.del(offerKey);
          resolve('timeout');
        }
      }, checkInterval);
    });
  }

  // ─── Asignación del conductor ─────────────────────────────────────────────────

  private async assignDriver(trip: Trip, driver: Driver): Promise<void> {
    this.logger.log(`Asignando conductor ${driver.id} al viaje ${trip.id}`);

    // Transacción: actualiza el viaje y marca al conductor como ocupado
    await this.dataSource.transaction(async (manager) => {
      await manager.update(Trip, trip.id, {
        driver_id: driver.id,
        vehicle_id: driver.vehicle.id,
        remisera_id: driver.remisera_id ?? null,
        status: TripStatus.ASSIGNED,
        assigned_at: new Date(),
      });
    });

    // Marca al conductor como ocupado en Redis (dura hasta que finalice el viaje)
    await this.redis.set(`driver:busy:${driver.id}`, '1');

    // Limpia las claves de matching
    await this.redis.del(`trip:matching:${trip.id}`);
    await this.redis.del(`trip:offer:${trip.id}:${driver.id}`);

    // Notifica al pasajero que encontró conductor
    const eta = await this.estimateEta(driver, trip);

    this.gateway.emitToTrip(trip.id, 'trip:driver_assigned', {
      driver: {
        id: driver.id,
        name: driver.user.name,
        rating: driver.user.rating_avg,
        photo: driver.user.avatar_url,
      },
      vehicle: {
        plate: driver.vehicle.plate,
        brand: driver.vehicle.brand,
        model: driver.vehicle.model,
        color: driver.vehicle.color,
        photo: driver.vehicle.photo_url,
      },
      etaMinutes: eta,
    });

    await this.notificationsService.sendToPassenger(trip.passenger_id, {
      title: 'Conductor en camino',
      body: `${driver.user.name} llegará en aproximadamente ${eta} minutos`,
      data: { type: 'driver_assigned', tripId: trip.id },
    });
  }

  // ─── Cancelación por falta de conductores ────────────────────────────────────

  private async cancelWithNoDrivers(trip: Trip): Promise<void> {
    await this.tripRepository.update(trip.id, {
      status: TripStatus.CANCELLED,
      cancelled_at: new Date(),
      cancelled_by: 'system',
      cancellation_reason: 'no_drivers_available',
    });

    this.gateway.emitToTrip(trip.id, 'trip:cancelled', {
      reason: 'no_drivers_available',
      message: 'No hay conductores disponibles en este momento. Intentá de nuevo en unos minutos.',
    });

    await this.notificationsService.sendToPassenger(trip.passenger_id, {
      title: 'Sin conductores disponibles',
      body: 'No encontramos conductores cerca. Intentá de nuevo en unos minutos.',
      data: { type: 'no_drivers', tripId: trip.id },
    });
  }

  // ─── API pública para respuestas del conductor ───────────────────────────────

  /**
   * Llamado desde AppGateway cuando el conductor acepta via WebSocket.
   * Escribe "accepted" en Redis para que waitForDriverResponse lo detecte.
   */
  async driverAccepted(tripId: string, driverId: string): Promise<void> {
    const offerKey = `trip:offer:${tripId}:${driverId}`;
    const exists = await this.redis.exists(offerKey);

    if (!exists) {
      // La oferta ya expiró — el conductor respondió tarde
      this.gateway.emitToDriver(driverId, 'trip:request_expired', { tripId });
      return;
    }

    // La oferta sigue vigente → marca como aceptada
    await this.redis.set(offerKey, 'accepted', 'KEEPTTL');
  }

  /**
   * Llamado desde AppGateway cuando el conductor rechaza via WebSocket.
   * Elimina la clave para que waitForDriverResponse resuelva como "rejected".
   */
  async driverRejected(tripId: string, driverId: string): Promise<void> {
    await this.redis.del(`trip:offer:${tripId}:${driverId}`);
  }

  /**
   * Llamado cuando el pasajero cancela durante el matching.
   * Interrumpe la oferta activa notificando al conductor actual.
   */
  async cancelMatching(tripId: string): Promise<void> {
    const activDriverId = await this.redis.get(`trip:matching:${tripId}`);

    if (activDriverId) {
      // Elimina la oferta activa → waitForDriverResponse resolverá como "rejected"
      await this.redis.del(`trip:offer:${tripId}:${activDriverId}`);

      // Notifica al conductor que el viaje ya no está disponible
      this.gateway.emitToDriver(activDriverId, 'trip:passenger_cancelled', { tripId });
    }

    await this.redis.del(`trip:matching:${tripId}`);
  }

  // ─── Liberar conductor al finalizar/cancelar viaje ───────────────────────────

  async releaseDriver(driverId: string): Promise<void> {
    await this.redis.del(`driver:busy:${driverId}`);
    this.logger.log(`Conductor ${driverId} liberado y disponible para nuevos viajes`);
  }

  // ─── Estimación de ETA ────────────────────────────────────────────────────────

  private async estimateEta(driver: Driver, trip: Trip): Promise<number> {
    /*
     * En producción: llamada a Google Maps Distance Matrix API.
     * Mientras tanto: fórmula de Haversine simple para no consumir quota en dev.
     */
    const driverCoords = driver.last_location?.coordinates;
    if (!driverCoords) return 5; // fallback

    const [driverLng, driverLat] = driverCoords;
    const [originLng, originLat] = trip.origin_coords.coordinates;

    const distanceKm = haversineKm(driverLat, driverLng, originLat, originLng);
    const avgSpeedKmh = 30; // velocidad promedio urbana en Salta
    const etaMinutes = Math.ceil((distanceKm / avgSpeedKmh) * 60);

    return Math.max(1, etaMinutes);
  }
}

// ─── Utilidad ─────────────────────────────────────────────────────────────────

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
```

---

### src/gateway/app.gateway.ts (fragmento relevante)

```typescript
@WebSocketGateway({ cors: true })
export class AppGateway implements OnGatewayConnection, OnGatewayDisconnect {

  @WebSocketServer()
  server: Server;

  constructor(private matchingService: MatchingService) {}

  // El conductor acepta el viaje
  @SubscribeMessage('trip:driver_accept')
  async handleDriverAccept(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tripId: string },
  ) {
    const driverId = client.data.userId; // se setea al autenticar el socket
    await this.matchingService.driverAccepted(data.tripId, driverId);
  }

  // El conductor rechaza el viaje
  @SubscribeMessage('trip:driver_reject')
  async handleDriverReject(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tripId: string },
  ) {
    const driverId = client.data.userId;
    await this.matchingService.driverRejected(data.tripId, driverId);
  }

  // Emite un evento al canal del viaje (pasajero + conductor escuchan)
  emitToTrip(tripId: string, event: string, data: unknown) {
    this.server.to(`trip:${tripId}`).emit(event, data);
  }

  // Emite un evento al canal privado del conductor
  emitToDriver(driverId: string, event: string, data: unknown) {
    this.server.to(`driver:${driverId}`).emit(event, data);
  }

  // Emite al panel web de la remisera
  emitToRemisera(remeseraId: string, event: string, data: unknown) {
    this.server.to(`remisera:${remeseraId}`).emit(event, data);
  }

  handleConnection(client: Socket) {
    // Al conectar, el cliente se une a su room privado
    const userId = client.data.userId;
    client.join(`driver:${userId}`);   // si es conductor
    // o bien el pasajero se une al room del viaje activo al solicitarlo
  }
}
```

---

## Diagrama de secuencia completo

```
Pasajero          API (TripsService)      MatchingService         Redis           Conductor A       Conductor B
   │                      │                      │                  │                  │                 │
   │── POST /trips ───────▶│                      │                  │                  │                 │
   │                      │── startMatching() ───▶│                  │                  │                 │
   │                      │                      │── findNearby() ──▶│                  │                 │
   │                      │                      │◀─ [A, B, ...] ───│                  │                 │
   │                      │                      │                  │                  │                 │
   │                      │                      │── SET offer A ──▶│                  │                 │
   │                      │                      │── emit request ──────────────────────▶│                 │
   │                      │                      │                  │                  │                 │
   │                      │                      │   (espera 15s)   │                  │                 │
   │                      │                      │                  │                  │                 │
   │                      │                      │◀── driver_reject ────────────────────│                 │
   │                      │                      │── DEL offer A ──▶│                  │                 │
   │                      │                      │                  │                  │                 │
   │                      │                      │── SET offer B ──▶│                  │                 │
   │                      │                      │── emit request ───────────────────────────────────────▶│
   │                      │                      │                  │                  │                 │
   │                      │                      │   (espera 15s)   │                  │                 │
   │                      │                      │                  │                  │                 │
   │                      │                      │◀── driver_accept ─────────────────────────────────────│
   │                      │                      │── SET offer B "accepted" ──▶│        │                 │
   │                      │                      │                  │                  │                 │
   │                      │                      │── assignDriver() │                  │                 │
   │                      │                      │── SET busy:B ───▶│                  │                 │
   │◀── trip:driver_assigned (WS) ───────────────│                  │                  │                 │
   │                      │                      │                  │                  │                 │
```

---

## Casos borde contemplados

| Caso | Comportamiento |
|---|---|
| Pasajero cancela durante la búsqueda | `cancelMatching()` elimina la oferta activa y notifica al conductor que tenía la oferta |
| Conductor acepta pero la oferta ya venció | La clave no existe en Redis → se emite `trip:request_expired` al conductor, no se asigna |
| Conductor se desconecta sin responder | El TTL de la clave expira → `waitForDriverResponse` resuelve como `timeout` → pasa al siguiente |
| Todos los candidatos rechazan o no responden | `cancelWithNoDrivers()` → notifica al pasajero y cancela el viaje con reason `no_drivers_available` |
| Conductor acepta dos veces (doble tap) | Redis `SET KEEPTTL` es idempotente; la asignación está en transacción DB |
| Sin conductores en el radio inicial | Se notifica al pasajero de inmediato sin iniciar el loop |
