# REMO — Modelo de Datos

## Entidades principales

---

### users
Tabla base para todos los usuarios del sistema (pasajeros y conductores comparten autenticación).

```sql
users
├── id                  UUID PRIMARY KEY
├── phone               VARCHAR(20) UNIQUE NOT NULL       -- número con código de país (+549...)
├── name                VARCHAR(100)
├── email               VARCHAR(150) UNIQUE
├── avatar_url          TEXT
├── role                ENUM('passenger', 'driver', 'remisera_admin', 'admin')
├── status              ENUM('pending', 'active', 'suspended', 'banned')
├── rating_avg          DECIMAL(2,1) DEFAULT 5.0
├── rating_count        INTEGER DEFAULT 0
├── created_at          TIMESTAMPTZ DEFAULT now()
└── updated_at          TIMESTAMPTZ DEFAULT now()
```

---

### drivers
Extensión de users para conductores. Solo existe si users.role = 'driver'.

```sql
drivers
├── id                  UUID PRIMARY KEY
├── user_id             UUID FK → users.id UNIQUE
├── remisera_id         UUID FK → remiseras.id NULL       -- NULL si es independiente
├── type                ENUM('remisera', 'independent')
├── approval_status     ENUM('pending', 'approved', 'rejected', 'suspended')
├── approved_by         UUID FK → users.id NULL           -- admin o remisera_admin que aprobó
├── approved_at         TIMESTAMPTZ
├── rejection_reason    TEXT
├── is_online           BOOLEAN DEFAULT false
├── last_location       GEOGRAPHY(POINT, 4326)            -- PostGIS: última posición conocida
├── last_seen_at        TIMESTAMPTZ
└── created_at          TIMESTAMPTZ DEFAULT now()
```

---

### vehicles
Vehículo asociado al conductor. Un conductor, un vehículo activo.

```sql
vehicles
├── id                  UUID PRIMARY KEY
├── driver_id           UUID FK → drivers.id
├── plate               VARCHAR(10) UNIQUE NOT NULL        -- patente
├── brand               VARCHAR(50)                        -- marca
├── model               VARCHAR(50)
├── year                SMALLINT
├── color               VARCHAR(30)
├── photo_url           TEXT
├── is_active           BOOLEAN DEFAULT true
└── created_at          TIMESTAMPTZ DEFAULT now()
```

---

### driver_documents
Documentos de habilitación del conductor. Cada documento es un registro independiente para poder manejar vencimientos.

```sql
driver_documents
├── id                  UUID PRIMARY KEY
├── driver_id           UUID FK → drivers.id
├── type                ENUM('dni_front', 'dni_back', 'selfie', 'license',
│                            'municipal_permit', 'vtv', 'insurance')
├── file_url            TEXT NOT NULL
├── expires_at          DATE                               -- NULL para los que no vencen (dni, selfie)
├── status              ENUM('pending', 'approved', 'rejected', 'expired')
├── reviewed_by         UUID FK → users.id NULL
├── reviewed_at         TIMESTAMPTZ
└── uploaded_at         TIMESTAMPTZ DEFAULT now()
```

---

### remiseras
Empresas de remises habilitadas.

```sql
remiseras
├── id                  UUID PRIMARY KEY
├── name                VARCHAR(150) NOT NULL
├── cuit                VARCHAR(13) UNIQUE
├── address             TEXT
├── phone               VARCHAR(20)
├── email               VARCHAR(150)
├── logo_url            TEXT
├── status              ENUM('active', 'suspended')
├── commission_pct      DECIMAL(4,2) DEFAULT 0.00         -- % que cobra la remisera sobre la tarifa
└── created_at          TIMESTAMPTZ DEFAULT now()
```

---

### remisera_admins
Usuarios con acceso al panel web de una remisera.

```sql
remisera_admins
├── id                  UUID PRIMARY KEY
├── user_id             UUID FK → users.id
├── remisera_id         UUID FK → remiseras.id
└── created_at          TIMESTAMPTZ DEFAULT now()
```

---

### trips
Corazón del sistema. Registra cada viaje desde la solicitud hasta el cierre.

```sql
trips
├── id                  UUID PRIMARY KEY
├── passenger_id        UUID FK → users.id
├── driver_id           UUID FK → drivers.id NULL         -- NULL hasta que se asigne conductor
├── vehicle_id          UUID FK → vehicles.id NULL
├── remisera_id         UUID FK → remiseras.id NULL       -- NULL si conductor independiente
│
├── -- Ubicaciones
├── origin_address      TEXT NOT NULL
├── origin_coords       GEOGRAPHY(POINT, 4326) NOT NULL
├── destination_address TEXT NOT NULL
├── destination_coords  GEOGRAPHY(POINT, 4326) NOT NULL
│
├── -- Estimaciones (al momento de la solicitud)
├── estimated_distance_km   DECIMAL(6,2)
├── estimated_duration_min  SMALLINT
├── estimated_price         DECIMAL(8,2)
│
├── -- Valores reales (al finalizar)
├── real_distance_km    DECIMAL(6,2)
├── real_duration_min   SMALLINT
├── final_price         DECIMAL(8,2)
│
├── -- Estado y tiempos
├── status              ENUM('requested', 'searching', 'assigned',
│                            'driver_arriving', 'in_progress',
│                            'completed', 'cancelled')
├── requested_at        TIMESTAMPTZ DEFAULT now()
├── assigned_at         TIMESTAMPTZ
├── driver_arrived_at   TIMESTAMPTZ
├── started_at          TIMESTAMPTZ
├── completed_at        TIMESTAMPTZ
├── cancelled_at        TIMESTAMPTZ
├── cancelled_by        ENUM('passenger', 'driver', 'system') NULL
├── cancellation_reason TEXT
│
└── created_at          TIMESTAMPTZ DEFAULT now()
```

---

### payments
Registro de cada pago asociado a un viaje.

```sql
payments
├── id                  UUID PRIMARY KEY
├── trip_id             UUID FK → trips.id UNIQUE
├── method              ENUM('cash', 'mercado_pago')
├── status              ENUM('pending', 'completed', 'failed', 'refunded')
├── amount              DECIMAL(8,2) NOT NULL
│
├── -- Solo para Mercado Pago
├── mp_payment_id       VARCHAR(100)                      -- ID externo de Mercado Pago
├── mp_status           VARCHAR(50)                       -- approved, rejected, pending...
│
├── -- Distribución (solo referencial, comisiones reales según config)
├── platform_fee        DECIMAL(8,2)                      -- comisión REMO
├── remisera_fee        DECIMAL(8,2)                      -- comisión remisera (si aplica)
├── driver_earnings     DECIMAL(8,2)                      -- lo que percibe el conductor
│
├── paid_at             TIMESTAMPTZ
└── created_at          TIMESTAMPTZ DEFAULT now()
```

---

### ratings
Calificaciones mutuas entre pasajero y conductor al finalizar el viaje.

```sql
ratings
├── id                  UUID PRIMARY KEY
├── trip_id             UUID FK → trips.id
├── from_user_id        UUID FK → users.id                -- quien califica
├── to_user_id          UUID FK → users.id                -- quien recibe la calificación
├── score               SMALLINT CHECK (score BETWEEN 1 AND 5)
├── comment             TEXT
└── created_at          TIMESTAMPTZ DEFAULT now()

-- Constraint: solo una calificación por viaje por dirección
UNIQUE (trip_id, from_user_id, to_user_id)
```

---

### emergency_contacts
Contactos de emergencia del pasajero para la función SOS.

```sql
emergency_contacts
├── id                  UUID PRIMARY KEY
├── user_id             UUID FK → users.id
├── name                VARCHAR(100) NOT NULL
├── phone               VARCHAR(20) NOT NULL
└── created_at          TIMESTAMPTZ DEFAULT now()
```

---

### trip_locations
Historial de posiciones GPS durante el viaje (para tracking en tiempo real y auditoría).

```sql
trip_locations
├── id                  BIGSERIAL PRIMARY KEY
├── trip_id             UUID FK → trips.id
├── coords              GEOGRAPHY(POINT, 4326) NOT NULL
└── recorded_at         TIMESTAMPTZ DEFAULT now()

-- Índice para consultas por viaje ordenadas por tiempo
INDEX (trip_id, recorded_at)
```

---

### notifications
Registro de todas las notificaciones push enviadas.

```sql
notifications
├── id                  UUID PRIMARY KEY
├── user_id             UUID FK → users.id
├── type                VARCHAR(50)                       -- trip_assigned, driver_arrived, etc.
├── title               VARCHAR(150)
├── body                TEXT
├── data                JSONB                             -- payload extra (trip_id, etc.)
├── sent_at             TIMESTAMPTZ DEFAULT now()
└── read_at             TIMESTAMPTZ
```

---

### fare_config
Configuración de tarifas por zona/municipio (para respetar topes regulados).

```sql
fare_config
├── id                  UUID PRIMARY KEY
├── name                VARCHAR(100)                      -- ej: "Gran Salta", "Tartagal"
├── zone                GEOGRAPHY(POLYGON, 4326)          -- polígono de la zona tarifaria
├── base_fare           DECIMAL(8,2)                      -- tarifa mínima (bajada de bandera)
├── price_per_km        DECIMAL(6,2)
├── price_per_min       DECIMAL(6,2)
├── platform_commission DECIMAL(4,2)                      -- % que cobra REMO
├── is_active           BOOLEAN DEFAULT true
└── updated_at          TIMESTAMPTZ DEFAULT now()
```

---

## Relaciones clave

```
users ──────────────── drivers (1:1)
                           │
                    ┌──────┴──────┐
               remiseras       (independiente)
                    │
             remisera_admins

drivers ──────────── vehicles (1:N, 1 activo)
drivers ──────────── driver_documents (1:N)

trips ──────────────── users (passenger) (N:1)
trips ──────────────── drivers (N:1)
trips ──────────────── vehicles (N:1)
trips ──────────────── remiseras (N:1, nullable)
trips ──────────────── payments (1:1)
trips ──────────────── ratings (1:N, máx 2)
trips ──────────────── trip_locations (1:N)
```

---

## Índices recomendados

```sql
-- Búsqueda de conductores disponibles por ubicación (el más crítico)
CREATE INDEX idx_drivers_location ON drivers USING GIST (last_location)
  WHERE is_online = true AND approval_status = 'approved';

-- Viajes por pasajero (historial)
CREATE INDEX idx_trips_passenger ON trips (passenger_id, created_at DESC);

-- Viajes por conductor (historial)
CREATE INDEX idx_trips_driver ON trips (driver_id, created_at DESC);

-- Documentos por vencimiento (alertas)
CREATE INDEX idx_documents_expiry ON driver_documents (expires_at)
  WHERE status = 'approved';

-- Tracking de viaje activo
CREATE INDEX idx_trip_locations_trip ON trip_locations (trip_id, recorded_at DESC);
```
