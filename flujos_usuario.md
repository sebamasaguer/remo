# REMO — Flujos de Usuario

## Actores del sistema

- **Pasajero**: solicita viajes desde la app mobile
- **Conductor**: recibe y ejecuta viajes desde la app mobile
- **Remisera**: gestiona su flota desde el panel web
- **Admin REMO**: administra el sistema completo

---

## 1. FLUJO DEL PASAJERO

### 1.1 Registro y onboarding

```
[Pantalla Bienvenida]
    → "Ingresar con teléfono"
        → Ingresa número de celular
        → Recibe SMS con código OTP
        → Ingresa código OTP
        → [Pantalla Completar Perfil]
            → Nombre y apellido
            → (Opcional) Email
            → Foto de perfil (opcional)
            → Aceptar términos y condiciones
        → [Home / Mapa] ✓
```

### 1.2 Solicitar un viaje

```
[Home / Mapa]
    → Ingresa destino en barra de búsqueda
        → Busca dirección o selecciona en el mapa
        → Confirma origen (GPS automático o ajusta manualmente)
        → [Pantalla Resumen del Viaje]
            → Muestra: origen → destino
            → Muestra: distancia estimada
            → Muestra: precio estimado (tarifa regulada)
            → Muestra: tiempo estimado de viaje
            → Selecciona método de pago: Efectivo / Mercado Pago
            → Botón "Buscar conductor"
```

### 1.3 Matching con conductor

```
[Pantalla Buscando conductor]
    → Animación de búsqueda en mapa (radio expandiéndose)
    → Sistema notifica a conductores disponibles cercanos

    CASO A — Conductor encontrado (< 3 min):
        → [Pantalla Conductor Asignado]
            → Foto, nombre y calificación del conductor
            → Marca y modelo del vehículo + patente
            → Tiempo estimado de llegada
            → Tracking en tiempo real del conductor en el mapa
            → Botón "Contactar conductor" (llamada in-app o WhatsApp)
            → Botón "Cancelar viaje" (disponible hasta que el conductor llega)

    CASO B — Sin conductores disponibles:
        → Mensaje: "No hay conductores disponibles en este momento"
        → Opción: "Avisame cuando haya uno" (notificación push)
        → Opción: "Intentar de nuevo"
```

### 1.4 Durante el viaje

```
[Pantalla En viaje]
    → Mapa con ruta activa
    → Datos del viaje: destino, tiempo restante estimado
    → Botón SOS / Emergencia
        → Opciones: llamar al 911 / compartir ubicación con contacto de confianza
    → Botón "Compartir viaje" (envía link de tracking a un contacto)
```

### 1.5 Finalización del viaje

```
[Conductor marca el viaje como finalizado]
    → [Pantalla Fin de Viaje]
        → Resumen: origen, destino, distancia, duración
        → Precio final

        SI pago en efectivo:
            → "Pagá $XXX al conductor"
            → Botón "Confirmar pago realizado"

        SI pago con Mercado Pago:
            → Cobro automático
            → Confirmación de pago exitoso

    → [Pantalla Calificación]
        → Calificar al conductor (1 a 5 estrellas)
        → Comentario opcional
        → Botón "Finalizar"
    → [Home / Mapa] ✓
```

### 1.6 Historial y perfil

```
[Menú lateral / Perfil]
    → Mis viajes (historial completo)
        → Ver detalle de cada viaje
        → Repetir viaje (carga origen/destino automáticamente)
    → Métodos de pago
        → Agregar / eliminar tarjeta Mercado Pago
    → Mis datos (editar perfil)
    → Contactos de emergencia (para SOS)
    → Soporte / Ayuda
    → Cerrar sesión
```

---

## 2. FLUJO DEL CONDUCTOR

### 2.1 Registro y habilitación

```
[Pantalla Bienvenida Conductor]
    → "Registrarme como conductor"
        → Ingresa número de celular
        → Recibe SMS con código OTP
        → Ingresa código OTP
        → [Pantalla Datos Personales]
            → Nombre y apellido
            → DNI (frente y dorso — foto)
            → Selfie de verificación
        → [Pantalla Datos del Vehículo]
            → Marca, modelo, año, color
            → Patente
            → Foto del vehículo
        → [Pantalla Documentación]
            → Licencia de conducir (foto)
            → Habilitación municipal vigente (foto)
            → VTV al día (foto)
            → Seguro del vehículo (foto)
        → [Pantalla Tipo de conductor]
            → Opción A: "Pertenezco a una remisera"
                → Buscar y seleccionar la remisera por nombre
                → Aprobación a cargo de: la remisera (desde su panel web)
            → Opción B: "Soy conductor independiente"
                → No requiere selección de remisera
                → Aprobación a cargo de: Admin REMO (desde panel de administración)
        → [Pantalla En revisión]
            → "Tu solicitud está siendo revisada"
            → Notificación push cuando sea aprobado (o rechazado con motivo)
```

### 2.2 Inicio de jornada

```
[Home Conductor — Offline]
    → Botón grande "Conectarme"
        → Activa disponibilidad
        → GPS se activa
    → [Home Conductor — Online]
        → Mapa con su posición
        → Estado: "Disponible — esperando viajes"
        → Ganancias del día (contador)
        → Botón "Desconectarme"
```

### 2.3 Recepción y aceptación de un viaje

```
[Notificación de viaje entrante] — ventana emergente (15 segundos para responder)
    → Muestra:
        → Nombre del pasajero y calificación
        → Distancia al pasajero (ej. "350 mts")
        → Destino del viaje
        → Precio estimado
        → Método de pago (efectivo / digital)
    → Botón "Aceptar"
    → Botón "Rechazar"

    SI acepta:
        → [Pantalla Ir a buscar al pasajero]
            → Navegación al punto de origen
            → Nombre y foto del pasajero
            → Botón "Contactar pasajero"
            → Botón "Llegué" (al arribar al punto de origen)

    SI rechaza o vence el tiempo:
        → Vuelve a estado Online disponible
        → (El sistema ofrece el viaje al siguiente conductor)
```

### 2.4 Durante el viaje

```
[Pantalla En viaje]
    → Navegación activa hacia el destino
    → Nombre del pasajero
    → Ruta en mapa
    → Botón "Finalizar viaje" (al llegar al destino)
```

### 2.5 Finalización del viaje

```
[Conductor presiona "Finalizar viaje"]
    → [Pantalla Cobro]
        → Precio final del viaje

        SI efectivo:
            → "Cobrar $XXX al pasajero"
            → Botón "Confirmar cobro recibido"

        SI Mercado Pago:
            → Cobro automático procesado
            → Confirmación

    → [Pantalla Calificación del pasajero]
        → Calificar al pasajero (1 a 5 estrellas)
        → Comentario opcional
        → Botón "Finalizar"
    → [Home Conductor — Online] ✓ (listo para el siguiente viaje)
```

### 2.6 Perfil y ganancias

```
[Menú / Perfil Conductor]
    → Mis ganancias
        → Vista diaria / semanal / mensual
        → Desglose por viaje
        → Total en efectivo / total digital
    → Mis viajes (historial)
    → Mis documentos (ver estado de habilitación)
    → Calificación promedio
    → Soporte / Ayuda
    → Cerrar sesión
```

---

## 3. FLUJO DE LA REMISERA (Panel Web)

### 3.1 Acceso al panel

```
[Login Web]
    → Email + contraseña
    → (Recuperar contraseña por email)
    → [Dashboard principal]
```

### 3.2 Dashboard principal

```
[Dashboard]
    → Mapa en tiempo real con posición de toda la flota
    → Contadores en tiempo real:
        → Conductores online / offline
        → Viajes en curso
        → Viajes completados hoy
        → Ingresos del día (digital + efectivo estimado)
    → Alertas: conductores con documentación por vencer
```

### 3.3 Gestión de conductores

```
[Sección Conductores]
    → Lista de todos los conductores de la flota
        → Estado: activo / inactivo / en revisión / suspendido
        → Calificación promedio
        → Viajes realizados
    → [Ver detalle de conductor]
        → Datos personales y del vehículo
        → Documentación con fechas de vencimiento
        → Historial de viajes
        → Botón: Suspender / Reactivar conductor
    → [Agregar conductor]
        → Invitar conductor por celular (recibe link de registro)
```

### 3.4 Historial de viajes

```
[Sección Viajes]
    → Tabla con todos los viajes de la flota
        → Filtros: por fecha, conductor, estado, método de pago
    → [Ver detalle de viaje]
        → Origen, destino, duración, precio
        → Conductor asignado
        → Pasajero (nombre y calificación)
        → Método de pago
```

### 3.5 Reportes y métricas

```
[Sección Reportes]
    → Ingresos por período (diario / semanal / mensual)
    → Viajes por conductor (ranking)
    → Horas pico de demanda
    → Zonas más frecuentes
    → Tasa de cancelación
    → Exportar a Excel / PDF
```

### 3.6 Configuración de la remisera

```
[Configuración]
    → Datos de la empresa (nombre, CUIT, dirección)
    → Cambiar contraseña
    → Usuarios del panel (agregar/quitar administradores)
    → Notificaciones (alertas de documentación por vencer, etc.)
```

---

## 4. ESTADOS GLOBALES DEL SISTEMA

```
VIAJE:
  solicitado → buscando_conductor → conductor_asignado
  → conductor_en_camino → pasajero_a_bordo → en_curso → finalizado
  → (en cualquier punto antes de iniciar) cancelado

CONDUCTOR:
  offline → online_disponible → en_camino_al_pasajero → en_viaje → online_disponible

PASAJERO:
  inactivo → buscando → esperando_conductor → en_viaje → calificando → inactivo
```

---

## 5. NOTIFICACIONES PUSH — RESUMEN

| Evento | Pasajero | Conductor |
|---|---|---|
| Conductor asignado | ✓ nombre, ETA | — |
| Conductor llegó al origen | ✓ | — |
| Viaje iniciado | ✓ | — |
| Viaje finalizado | ✓ | ✓ |
| Pago confirmado | ✓ | ✓ |
| Sin conductores disponibles | ✓ | — |
| Nuevo viaje disponible | — | ✓ (ventana emergente) |
| Documentación por vencer | — | ✓ (7 días antes) |
| Solicitud aprobada/rechazada | — | ✓ |
