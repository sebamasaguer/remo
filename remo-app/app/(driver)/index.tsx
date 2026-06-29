import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Alert, Switch, Modal,
  ActivityIndicator, Linking,
} from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { useAuthStore } from '@/store/auth.store';
import { useSocket } from '@/hooks/useSocket';
import {
  setOnlineStatus, updateLocation, completeTrip, driverArrived, startTrip,
  getDriverProfile, getEarnings, type ApprovalStatus,
} from '@/api/drivers';
import { COLORS } from '@/constants';

type DriverStatus = 'offline' | 'online' | 'offer' | 'assigned' | 'arriving' | 'in_progress';

const openMaps = (address: string) => {
  const q = encodeURIComponent(address);
  Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`).catch(() => {});
};

export default function DriverHome() {
  const { user } = useAuthStore();
  const mapRef = useRef<MapView>(null);
  const locationInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | undefined>();
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [driverStatus, setDriverStatus] = useState<DriverStatus>('offline');
  const [pendingOffer, setPendingOffer] = useState<any>(null);
  const [activeTrip, setActiveTrip] = useState<any>(null);
  const [offerTimer, setOfferTimer] = useState(15);
  const offerTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [todayEarnings, setTodayEarnings] = useState(0);
  const [todayTrips, setTodayTrips] = useState(0);

  const socket = useSocket();

  useEffect(() => {
    getDriverProfile()
      .then(({ data }) => {
        setApprovalStatus(data.approvalStatus);
        setRejectionReason(data.rejectionReason);
        if (data.approvalStatus === 'approved') {
          getEarnings('day')
            .then(({ data: e }) => {
              setTodayEarnings(e.totalEarnings);
              setTodayTrips(e.totalTrips);
            })
            .catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => setLoadingProfile(false));
  }, []);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({});
      setLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    })();
  }, []);

  useEffect(() => {
    if (!socket) return;

    socket.on('trip:new_request', (data: any) => {
      setPendingOffer(data);
      setDriverStatus('offer');
      startOfferTimer();
    });

    socket.on('trip:assigned_to_you', (data: any) => {
      setActiveTrip(data);
      setDriverStatus('assigned');
      setPendingOffer(null);
    });

    socket.on('trip:passenger_cancelled', () => {
      setActiveTrip(null);
      setDriverStatus('online');
      Alert.alert('Viaje cancelado', 'El pasajero canceló el viaje.');
    });

    socket.on('trip:offer_expired', () => {
      setPendingOffer(null);
      setDriverStatus('online');
    });

    return () => {
      socket.off('trip:new_request');
      socket.off('trip:assigned_to_you');
      socket.off('trip:passenger_cancelled');
      socket.off('trip:offer_expired');
    };
  }, [socket]);

  const startOfferTimer = () => {
    setOfferTimer(15);
    if (offerTimerRef.current) clearInterval(offerTimerRef.current);
    offerTimerRef.current = setInterval(() => {
      setOfferTimer((t) => {
        if (t <= 1) {
          clearInterval(offerTimerRef.current!);
          setPendingOffer(null);
          setDriverStatus('online');
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  const toggleOnline = async (value: boolean) => {
    try {
      await setOnlineStatus(value);
      setDriverStatus(value ? 'online' : 'offline');

      if (value && location) {
        locationInterval.current = setInterval(async () => {
          const loc = await Location.getCurrentPositionAsync({});
          setLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
          await updateLocation(loc.coords.latitude, loc.coords.longitude);
        }, 5000);
      } else {
        if (locationInterval.current) clearInterval(locationInterval.current);
      }
    } catch {
      Alert.alert('Error', 'No se pudo cambiar el estado.');
    }
  };

  const handleAccept = () => {
    if (!pendingOffer || !socket) return;
    socket.emit('trip:accept', { tripId: pendingOffer.tripId });
    if (offerTimerRef.current) clearInterval(offerTimerRef.current);
  };

  const handleReject = () => {
    if (!pendingOffer || !socket) return;
    socket.emit('trip:reject', { tripId: pendingOffer.tripId });
    if (offerTimerRef.current) clearInterval(offerTimerRef.current);
    setPendingOffer(null);
    setDriverStatus('online');
  };

  const handleArrived = async () => {
    if (!activeTrip) return;
    try {
      await driverArrived(activeTrip.tripId);
      setDriverStatus('arriving');
    } catch { }
  };

  const handleStart = async () => {
    if (!activeTrip) return;
    try {
      await startTrip(activeTrip.tripId);
      setDriverStatus('in_progress');
    } catch { }
  };

  const handleComplete = async () => {
    if (!activeTrip) return;
    try {
      await completeTrip(activeTrip.tripId);
      const fare = activeTrip.estimatedPrice ?? 0;
      setTodayEarnings((e) => e + fare);
      setTodayTrips((t) => t + 1);
      setActiveTrip(null);
      setDriverStatus('online');
      Alert.alert('¡Viaje completado!', `Ganaste $${fare.toFixed(2)}`);
    } catch { }
  };

  // ── Estados de aprobación ───────────────────────────────────────────────────

  if (loadingProfile) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (approvalStatus === 'pending') {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
        <Text style={{ fontSize: 64, marginBottom: 24 }}>⏳</Text>
        <Text style={{ fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: 12, textAlign: 'center' }}>
          Solicitud en revisión
        </Text>
        <Text style={{ fontSize: 15, color: COLORS.textLight, textAlign: 'center', lineHeight: 22 }}>
          Tu registro está siendo revisado por el equipo de REMO. Te avisaremos por notificación cuando sea aprobado.
        </Text>
      </View>
    );
  }

  if (approvalStatus === 'rejected') {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
        <Text style={{ fontSize: 64, marginBottom: 24 }}>❌</Text>
        <Text style={{ fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: 12, textAlign: 'center' }}>
          Solicitud rechazada
        </Text>
        {rejectionReason && (
          <View style={{ backgroundColor: '#FEF2F2', borderRadius: 12, padding: 16, marginBottom: 16, width: '100%' }}>
            <Text style={{ fontSize: 14, color: COLORS.danger, lineHeight: 20 }}>{rejectionReason}</Text>
          </View>
        )}
        <Text style={{ fontSize: 14, color: COLORS.textLight, textAlign: 'center' }}>
          Contactá con soporte para más información.
        </Text>
      </View>
    );
  }

  if (approvalStatus === 'suspended') {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
        <Text style={{ fontSize: 64, marginBottom: 24 }}>🚫</Text>
        <Text style={{ fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: 12, textAlign: 'center' }}>
          Cuenta suspendida
        </Text>
        {rejectionReason && (
          <View style={{ backgroundColor: '#FEF2F2', borderRadius: 12, padding: 16, marginBottom: 16, width: '100%' }}>
            <Text style={{ fontSize: 14, color: COLORS.danger, lineHeight: 20 }}>{rejectionReason}</Text>
          </View>
        )}
        <Text style={{ fontSize: 14, color: COLORS.textLight, textAlign: 'center' }}>
          Contactá con soporte para más información.
        </Text>
      </View>
    );
  }

  // ── Pantalla principal (approved) ───────────────────────────────────────────

  const isOnline = driverStatus !== 'offline';
  const isBusy = driverStatus === 'offer' || driverStatus === 'in_progress' || driverStatus === 'assigned' || driverStatus === 'arriving';

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.white }}>
      {/* Mapa */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={{ flex: 1 }}
        showsUserLocation
        initialRegion={
          location
            ? { latitude: location.lat, longitude: location.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }
            : { latitude: -24.7821, longitude: -65.4232, latitudeDelta: 0.05, longitudeDelta: 0.05 }
        }
      />

      {/* Header */}
      <View style={{
        position: 'absolute', top: 56, left: 16, right: 16,
        backgroundColor: COLORS.white, borderRadius: 16,
        paddingHorizontal: 16, paddingVertical: 12,
        flexDirection: 'row', alignItems: 'center',
        elevation: 6, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8,
      }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '700', fontSize: 15, color: COLORS.text }}>
            {user?.name?.split(' ')[0] ?? 'Conductor'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
            <View style={{
              width: 7, height: 7, borderRadius: 4,
              backgroundColor: isOnline ? COLORS.success : COLORS.muted,
              marginRight: 5,
            }} />
            <Text style={{ fontSize: 12, color: isOnline ? COLORS.success : COLORS.muted }}>
              {isOnline ? 'En línea' : 'Desconectado'}
            </Text>
          </View>
        </View>

        {/* Ganancias hoy */}
        <View style={{ alignItems: 'flex-end', marginRight: 16 }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.text }}>
            ${todayEarnings.toFixed(2)}
          </Text>
          <Text style={{ fontSize: 11, color: COLORS.muted }}>
            {todayTrips} viaje{todayTrips !== 1 ? 's' : ''} hoy
          </Text>
        </View>

        <Switch
          value={isOnline}
          onValueChange={toggleOnline}
          trackColor={{ false: COLORS.border, true: COLORS.primary }}
          thumbColor={COLORS.white}
          disabled={isBusy}
        />
      </View>

      {/* Panel inferior */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: COLORS.white,
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24,
        elevation: 12,
        shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 12,
      }}>
        {/* Handle */}
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: 16 }} />

        {/* ── Offline ── */}
        {driverStatus === 'offline' && (
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <View style={{
                flex: 1, backgroundColor: COLORS.surface, borderRadius: 12,
                padding: 14, marginRight: 8, alignItems: 'center',
              }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: COLORS.text }}>
                  ${todayEarnings.toFixed(2)}
                </Text>
                <Text style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>Ganado hoy</Text>
              </View>
              <View style={{
                flex: 1, backgroundColor: COLORS.surface, borderRadius: 12,
                padding: 14, marginLeft: 8, alignItems: 'center',
              }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: COLORS.text }}>{todayTrips}</Text>
                <Text style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>
                  Viaje{todayTrips !== 1 ? 's' : ''} hoy
                </Text>
              </View>
            </View>
            <Text style={{ fontSize: 14, color: COLORS.textLight, textAlign: 'center', marginBottom: 16 }}>
              Activá el switch para empezar a recibir viajes
            </Text>
            <TouchableOpacity
              onPress={() => toggleOnline(true)}
              style={{ backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Conectarme</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Online esperando ── */}
        {driverStatus === 'online' && (
          <View style={{ alignItems: 'center', paddingVertical: 8 }}>
            <ActivityIndicator color={COLORS.primary} size="large" style={{ marginBottom: 12 }} />
            <Text style={{ fontSize: 17, fontWeight: '700', color: COLORS.text, marginBottom: 4 }}>
              Buscando viajes...
            </Text>
            <Text style={{ fontSize: 13, color: COLORS.textLight, marginBottom: 20 }}>
              Te avisaremos cuando llegue una solicitud
            </Text>
            <TouchableOpacity
              onPress={() => toggleOnline(false)}
              style={{
                borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12,
                paddingVertical: 12, paddingHorizontal: 24,
              }}
            >
              <Text style={{ color: COLORS.textLight, fontWeight: '600' }}>Desconectarme</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Asignado: ir al pasajero ── */}
        {driverStatus === 'assigned' && activeTrip && (
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary, marginRight: 8 }} />
              <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text }}>
                Dirigite al pasajero
              </Text>
            </View>

            {/* Info pasajero */}
            <View style={{ backgroundColor: COLORS.surface, borderRadius: 14, padding: 14, marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                <View style={{
                  width: 40, height: 40, borderRadius: 20,
                  backgroundColor: COLORS.primary + '20', alignItems: 'center', justifyContent: 'center',
                  marginRight: 10,
                }}>
                  <Text style={{ fontSize: 20 }}>👤</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', fontSize: 15, color: COLORS.text }}>
                    {activeTrip.passenger?.name ?? 'Pasajero'}
                  </Text>
                  <Text style={{ fontSize: 13, color: COLORS.secondary }}>
                    ⭐ {activeTrip.passenger?.rating?.toFixed(1) ?? '5.0'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: COLORS.text }}>
                    ${(activeTrip.estimatedPrice ?? 0).toFixed(2)}
                  </Text>
                  <Text style={{ fontSize: 11, color: COLORS.muted }}>
                    {activeTrip.paymentMethod === 'cash' ? '💵 Efectivo' : '📱 Mercado Pago'}
                  </Text>
                </View>
              </View>

              <View style={{ borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 10, gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  <Text style={{ fontSize: 14, marginRight: 6 }}>📍</Text>
                  <Text style={{ flex: 1, fontSize: 13, color: COLORS.textLight }} numberOfLines={2}>
                    {activeTrip.originAddress}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  <Text style={{ fontSize: 14, marginRight: 6 }}>🏁</Text>
                  <Text style={{ flex: 1, fontSize: 13, color: COLORS.textLight }} numberOfLines={2}>
                    {activeTrip.destinationAddress}
                  </Text>
                </View>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={() => openMaps(activeTrip.originAddress)}
                style={{
                  flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center',
                  backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.border,
                  flexDirection: 'row', justifyContent: 'center', gap: 6,
                }}
              >
                <Text style={{ fontSize: 16 }}>🗺</Text>
                <Text style={{ color: COLORS.text, fontWeight: '600', fontSize: 14 }}>Navegar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleArrived}
                style={{ flex: 2, borderRadius: 12, paddingVertical: 13, alignItems: 'center', backgroundColor: COLORS.primary }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Llegué al pasajero</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Arriving: esperando que el pasajero suba ── */}
        {driverStatus === 'arriving' && activeTrip && (
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.secondary, marginRight: 8 }} />
              <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text }}>Esperando al pasajero</Text>
            </View>
            <Text style={{ fontSize: 13, color: COLORS.textLight, marginBottom: 14 }}>
              {activeTrip.passenger?.name ?? 'El pasajero'} fue notificado de tu llegada.
            </Text>

            <View style={{ backgroundColor: COLORS.surface, borderRadius: 12, padding: 12, marginBottom: 14, flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 14, marginRight: 6 }}>🏁</Text>
              <Text style={{ flex: 1, fontSize: 13, color: COLORS.textLight }} numberOfLines={2}>
                {activeTrip.destinationAddress}
              </Text>
              <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.text, marginLeft: 8 }}>
                ${(activeTrip.estimatedPrice ?? 0).toFixed(2)}
              </Text>
            </View>

            <TouchableOpacity
              onPress={handleStart}
              style={{ backgroundColor: COLORS.success, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Iniciar viaje</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── En progreso ── */}
        {driverStatus === 'in_progress' && activeTrip && (
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.success, marginRight: 8 }} />
              <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text }}>Viaje en curso</Text>
            </View>

            <View style={{ backgroundColor: COLORS.surface, borderRadius: 14, padding: 14, marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <Text style={{ fontSize: 13, color: COLORS.textLight }}>Tarifa estimada</Text>
                <Text style={{ fontSize: 24, fontWeight: '800', color: COLORS.text }}>
                  ${(activeTrip.estimatedPrice ?? 0).toFixed(2)}
                </Text>
              </View>
              <View style={{ borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 10, flexDirection: 'row', alignItems: 'flex-start' }}>
                <Text style={{ fontSize: 14, marginRight: 6 }}>🏁</Text>
                <Text style={{ flex: 1, fontSize: 13, color: COLORS.textLight }} numberOfLines={2}>
                  {activeTrip.destinationAddress}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={() => openMaps(activeTrip.destinationAddress)}
                style={{
                  flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center',
                  backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.border,
                  flexDirection: 'row', justifyContent: 'center', gap: 6,
                }}
              >
                <Text style={{ fontSize: 16 }}>🗺</Text>
                <Text style={{ color: COLORS.text, fontWeight: '600', fontSize: 14 }}>Navegar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleComplete}
                style={{ flex: 2, borderRadius: 12, paddingVertical: 13, alignItems: 'center', backgroundColor: COLORS.success }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Completar viaje</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Modal oferta de viaje */}
      <Modal visible={driverStatus === 'offer' && !!pendingOffer} transparent animationType="slide">
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{
            backgroundColor: COLORS.white,
            borderTopLeftRadius: 28, borderTopRightRadius: 28,
            padding: 24,
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: COLORS.text }}>Nueva solicitud</Text>
              <View style={{
                width: 48, height: 48, borderRadius: 24,
                backgroundColor: offerTimer <= 5 ? '#FEF2F2' : '#EEF2FF',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: offerTimer <= 5 ? COLORS.danger : COLORS.primary }}>
                  {offerTimer}
                </Text>
              </View>
            </View>

            {/* Info pasajero */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
              <View style={{
                width: 44, height: 44, borderRadius: 22,
                backgroundColor: COLORS.primary + '15',
                alignItems: 'center', justifyContent: 'center', marginRight: 10,
              }}>
                <Text style={{ fontSize: 22 }}>👤</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', fontSize: 15, color: COLORS.text }}>
                  {pendingOffer?.passenger?.name ?? 'Pasajero'}
                </Text>
                <Text style={{ fontSize: 13, color: COLORS.secondary }}>
                  ⭐ {pendingOffer?.passenger?.rating?.toFixed(1) ?? '5.0'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 26, fontWeight: '800', color: COLORS.text }}>
                  ${(pendingOffer?.estimatedPrice ?? 0).toFixed(2)}
                </Text>
                <Text style={{ fontSize: 12, color: COLORS.muted }}>
                  {pendingOffer?.paymentMethod === 'cash' ? '💵 Efectivo' : '📱 Mercado Pago'}
                </Text>
              </View>
            </View>

            {/* Ruta */}
            <View style={{ backgroundColor: COLORS.surface, borderRadius: 14, padding: 14, marginBottom: 20, gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <Text style={{ fontSize: 14, marginRight: 8 }}>📍</Text>
                <Text style={{ flex: 1, fontSize: 13, color: COLORS.textLight }} numberOfLines={2}>
                  {pendingOffer?.originAddress}
                </Text>
              </View>
              <View style={{ height: 1, backgroundColor: COLORS.border, marginLeft: 22 }} />
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <Text style={{ fontSize: 14, marginRight: 8 }}>🏁</Text>
                <Text style={{ flex: 1, fontSize: 13, color: COLORS.textLight }} numberOfLines={2}>
                  {pendingOffer?.destinationAddress}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={handleReject}
                style={{
                  flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center',
                  backgroundColor: '#FEF2F2', borderWidth: 1.5, borderColor: '#FECACA',
                }}
              >
                <Text style={{ color: COLORS.danger, fontWeight: '700', fontSize: 15 }}>Rechazar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleAccept}
                style={{ flex: 2, borderRadius: 14, paddingVertical: 14, alignItems: 'center', backgroundColor: COLORS.primary }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Aceptar viaje</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
