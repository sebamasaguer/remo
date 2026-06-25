# REMO — Arquitectura del Backend

## Stack

- **Runtime**: Node.js 20+
- **Framework**: NestJS (TypeScript)
- **Base de datos**: PostgreSQL 16 + PostGIS
- **ORM**: TypeORM
- **Tiempo real**: Socket.io
- **Caché / Estado**: Redis
- **Autenticación**: JWT (access token 15min + refresh token 7 días)
- **SMS OTP**: Twilio o AWS SNS
- **Pagos**: Mercado Pago SDK
- **Mapas / Rutas**: Google Maps Platform (Directions + Distance Matrix)
- **Push notifications**: Firebase Admin SDK (FCM)
- **Storage**: AWS S3 (documentos, fotos)
- **Contenerización**: Docker + Docker Compose

---

## Estructura de carpetas

```
remo-backend/
├── src/
│   ├── main.ts                         -- bootstrap de la app
│   ├── app.module.ts                   -- módulo raíz
│   │
│   ├── config/                         -- variables de entorno tipadas
│   │   ├── app.config.ts
│   │   ├── database.config.ts
│   │   ├── redis.config.ts
│   │   └── jwt.config.ts
│   │
│   ├── common/                         -- código compartido
│   │   ├── decorators/
│   │   │   ├── current-user.decorator.ts
│   │   │   └── roles.decorator.ts
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts
│   │   │   └── roles.guard.ts
│   │   ├── interceptors/
│   │   │   └── response.interceptor.ts -- envelope { data, meta }
│   │   ├── filters/
│   │   │   └── http-exception.filter.ts
│   │   ├── pipes/
│   │   │   └── validation.pipe.ts
│   │   └── types/
│   │       └── express.d.ts            -- extiende Request con user
│   │
│   ├── modules/
│   │   │
│   │   ├── auth/                       -- autenticación por OTP + JWT
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── otp.service.ts          -- genera y valida OTP via SMS
│   │   │   ├── token.service.ts        -- genera y refresca JWT
│   │   │   └── dto/
│   │   │       ├── request-otp.dto.ts
│   │   │       └── verify-otp.dto.ts
│   │   │
│   │   ├── users/
│   │   │   ├── users.module.ts
│   │   │   ├── users.controller.ts
│   │   │   ├── users.service.ts
│   │   │   ├── entities/
│   │   │   │   └── user.entity.ts
│   │   │   └── dto/
│   │   │       └── update-profile.dto.ts
│   │   │
│   │   ├── drivers/
│   │   │   ├── drivers.module.ts
│   │   │   ├── drivers.controller.ts
│   │   │   ├── drivers.service.ts
│   │   │   ├── entities/
│   │   │   │   ├── driver.entity.ts
│   │   │   │   ├── vehicle.entity.ts
│   │   │   │   └── driver-document.entity.ts
│   │   │   └── dto/
│   │   │       ├── register-driver.dto.ts
│   │   │       ├── update-vehicle.dto.ts
│   │   │       └── update-location.dto.ts
│   │   │
│   │   ├── remiseras/
│   │   │   ├── remiseras.module.ts
│   │   │   ├── remiseras.controller.ts
│   │   │   ├── remiseras.service.ts
│   │   │   ├── entities/
│   │   │   │   └── remisera.entity.ts
│   │   │   └── dto/
│   │   │       └── create-remisera.dto.ts
│   │   │
│   │   ├── trips/
│   │   │   ├── trips.module.ts
│   │   │   ├── trips.controller.ts
│   │   │   ├── trips.service.ts
│   │   │   ├── matching.service.ts     -- lógica de asignación conductor-viaje
│   │   │   ├── entities/
│   │   │   │   ├── trip.entity.ts
│   │   │   │   └── trip-location.entity.ts
│   │   │   └── dto/
│   │   │       ├── create-trip.dto.ts
│   │   │       └── update-trip-status.dto.ts
│   │   │
│   │   ├── payments/
│   │   │   ├── payments.module.ts
│   │   │   ├── payments.controller.ts
│   │   │   ├── payments.service.ts
│   │   │   ├── mercadopago.service.ts
│   │   │   ├── entities/
│   │   │   │   └── payment.entity.ts
│   │   │   └── dto/
│   │   │       └── process-payment.dto.ts
│   │   │
│   │   ├── ratings/
│   │   │   ├── ratings.module.ts
│   │   │   ├── ratings.controller.ts
│   │   │   ├── ratings.service.ts
│   │   │   └── entities/
│   │   │       └── rating.entity.ts
│   │   │
│   │   ├── fares/
│   │   │   ├── fares.module.ts
│   │   │   ├── fares.controller.ts
│   │   │   ├── fares.service.ts        -- calcula precio estimado según zona
│   │   │   └── entities/
│   │   │       └── fare-config.entity.ts
│   │   │
│   │   ├── notifications/
│   │   │   ├── notifications.module.ts
│   │   │   ├── notifications.service.ts -- envía push via FCM
│   │   │   └── entities/
│   │   │       └── notification.entity.ts
│   │   │
│   │   └── uploads/
│   │       ├── uploads.module.ts
│   │       ├── uploads.controller.ts
│   │       └── uploads.service.ts      -- sube archivos a S3
│   │
│   └── gateway/                        -- WebSocket (Socket.io)
│       ├── gateway.module.ts
│       ├── app.gateway.ts              -- hub principal de eventos en tiempo real
│       └── gateway.service.ts          -- lógica de rooms y broadcasting
│
├── test/
├── docker-compose.yml
├── docker-compose.prod.yml
├── Dockerfile
├── .env.example
└── package.json
```

---

## API REST — Endpoints

### Auth
```
POST   /auth/request-otp          -- solicita OTP por SMS
POST   /auth/verify-otp           -- verifica OTP → devuelve access + refresh token
POST   /auth/refresh              -- renueva access token con refresh token
POST   /auth/logout               -- invalida refresh token
```

### Users
```
GET    /users/me                  -- perfil del usuario autenticado
PATCH  /users/me                  -- actualiza nombre, email, avatar
DELETE /users/me                  -- elimina cuenta

GET    /users/me/emergency-contacts
POST   /users/me/emergency-contacts
DELETE /users/me/emergency-contacts/:id
```

### Drivers
```
POST   /drivers/register          -- registro inicial del conductor
GET    /drivers/me                -- perfil del conductor autenticado
PATCH  /drivers/me/vehicle        -- actualiza datos del vehículo

POST   /drivers/me/location       -- actualiza posición GPS (polling cada 5s cuando online)
PATCH  /drivers/me/status         -- conectar / desconectar  { is_online: true/false }

GET    /drivers/me/documents      -- lista documentos y sus estados
POST   /drivers/me/documents      -- sube un documento (multipart/form-data)

GET    /drivers/me/earnings       -- ganancias con filtro de período
GET    /drivers/me/trips          -- historial de viajes del conductor
```

### Remiseras
```
-- Panel web de remisera (rol: remisera_admin)
GET    /remiseras/me                        -- datos de la remisera
PATCH  /remiseras/me                        -- actualiza datos

GET    /remiseras/me/drivers                -- lista conductores de la flota
GET    /remiseras/me/drivers/:id            -- detalle de un conductor
PATCH  /remiseras/me/drivers/:id/approve    -- aprueba conductor
PATCH  /remiseras/me/drivers/:id/reject     -- rechaza conductor (con motivo)
PATCH  /remiseras/me/drivers/:id/suspend    -- suspende conductor

GET    /remiseras/me/trips                  -- historial de viajes de la flota
GET    /remiseras/me/reports/earnings       -- reporte de ingresos
GET    /remiseras/me/reports/activity       -- reporte de actividad por conductor
```

### Trips
```
POST   /trips                     -- pasajero solicita un viaje
GET    /trips/:id                 -- detalle de un viaje
GET    /trips/history             -- historial del usuario autenticado (pasajero o conductor)

PATCH  /trips/:id/accept          -- conductor acepta el viaje
PATCH  /trips/:id/reject          -- conductor rechaza el viaje
PATCH  /trips/:id/arrived         -- conductor marcó que llegó al origen
PATCH  /trips/:id/start           -- conductor inicia el viaje
PATCH  /trips/:id/complete        -- conductor finaliza el viaje
PATCH  /trips/:id/cancel          -- pasajero o conductor cancela

GET    /trips/:id/estimate        -- calcula precio estimado (antes de solicitar)
```

### Payments
```
GET    /payments/:tripId          -- detalle del pago de un viaje
POST   /payments/:tripId/confirm-cash   -- confirma cobro/pago en efectivo
POST   /payments/webhook          -- webhook de Mercado Pago (público, sin auth)
```

### Ratings
```
POST   /ratings                   -- crea calificación al finalizar un viaje
GET    /ratings/me                -- calificaciones recibidas por el usuario autenticado
```

### Fares
```
GET    /fares/estimate            -- estima precio { origin, destination }
GET    /fares/config              -- configuración tarifaria vigente (solo admin)
```

### Uploads
```
POST   /uploads/presigned-url     -- genera URL firmada de S3 para subir desde el cliente
```

### Admin
```
-- Solo rol: admin
GET    /admin/users               -- lista todos los usuarios
GET    /admin/drivers/pending     -- conductores independientes pendientes de aprobación
PATCH  /admin/drivers/:id/approve
PATCH  /admin/drivers/:id/reject
GET    /admin/remiseras           -- lista todas las remiseras
POST   /admin/remiseras           -- crea una remisera
PATCH  /admin/remiseras/:id
GET    /admin/trips               -- todos los viajes con filtros
GET    /admin/fares               -- configuración de tarifas
POST   /admin/fares
PATCH  /admin/fares/:id
```

---

## WebSocket — Eventos en tiempo real

### Rooms (canales de Socket.io)
```
trip:{tripId}        -- canal del viaje activo (pasajero + conductor escuchan)
driver:{driverId}    -- canal privado del conductor (recibe notificación de viaje)
remisera:{remeseraId} -- canal del panel web de la remisera
```

### Eventos emitidos por el cliente → servidor
```
driver:update_location    { lat, lng }               -- conductor actualiza posición
trip:driver_accept        { tripId }                 -- conductor acepta viaje
trip:driver_reject        { tripId }                 -- conductor rechaza viaje
```

### Eventos emitidos por el servidor → cliente
```
-- Al pasajero
trip:driver_assigned      { driver, vehicle, eta }   -- conductor encontrado
trip:driver_location      { lat, lng }               -- posición del conductor en camino
trip:driver_arrived                                  -- conductor llegó al origen
trip:started                                         -- viaje iniciado
trip:completed            { finalPrice }             -- viaje finalizado
trip:cancelled            { reason }                 -- viaje cancelado

-- Al conductor
trip:new_request          { tripId, passenger, origin, destination, price, paymentMethod }
trip:request_expired                                 -- venció el tiempo de respuesta (15s)
trip:passenger_cancelled                             -- pasajero canceló antes de iniciar

-- Al panel remisera
fleet:driver_online       { driverId, location }
fleet:driver_offline      { driverId }
fleet:driver_location     { driverId, lat, lng }
fleet:trip_started        { tripId, driverId }
fleet:trip_completed      { tripId }
```

---

## Flujo de matching (MatchingService)

```
1. Pasajero solicita viaje (POST /trips)
2. Se crea el trip con status = 'searching'
3. MatchingService consulta en Redis los conductores online
   ordenados por distancia al origen (PostGIS ST_Distance)
4. Se itera la lista (máx 10 conductores más cercanos):
   a. Emite trip:new_request al conductor via WebSocket
   b. Espera 15 segundos (timeout en Redis)
   c. SI el conductor acepta → asigna el viaje, notifica al pasajero, sale del loop
   d. SI rechaza o vence → pasa al siguiente conductor
5. Si ninguno acepta → status = 'cancelled' (sin conductor disponible), notifica al pasajero
```

---

## Variables de entorno (.env.example)

```env
# App
NODE_ENV=development
PORT=3000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=remo_db
DB_USER=remo_user
DB_PASS=remo_pass

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# SMS (Twilio)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# Firebase (push notifications)
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=

# Google Maps
GOOGLE_MAPS_API_KEY=

# Mercado Pago
MP_ACCESS_TOKEN=
MP_WEBHOOK_SECRET=

# AWS S3
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
AWS_S3_BUCKET=
```

---

## Docker Compose (desarrollo)

```yaml
version: '3.9'

services:
  api:
    build: .
    ports:
      - "3000:3000"
    env_file: .env
    depends_on:
      - db
      - redis
    volumes:
      - ./src:/app/src

  db:
    image: postgis/postgis:16-3.4
    environment:
      POSTGRES_DB: remo_db
      POSTGRES_USER: remo_user
      POSTGRES_PASSWORD: remo_pass
    ports:
      - "5432:5432"
    volumes:
      - pg_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  pg_data:
```

---

## Decisiones de diseño

| Decisión | Elección | Motivo |
|---|---|---|
| Actualización de ubicación del conductor | HTTP polling cada 5s (online) + WebSocket para broadcasting | Más simple que WebSocket bidireccional puro; el servidor controla el rate |
| Almacenamiento de documentos | S3 con URLs firmadas | El cliente sube directo a S3, el backend nunca maneja el binario |
| OTP | SMS (no email) | La mayoría de los conductores no tienen email configurado |
| Matching | Redis + PostGIS | Redis para estado online en tiempo real; PostGIS para cálculo de distancia |
| Tarifas | fare_config en DB | Permite actualizar topes municipales sin redesplegar código |
| Refresh token | Guardado en Redis con TTL | Permite invalidación inmediata en logout |
