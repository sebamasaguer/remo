import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, Alert, Switch, Modal, ActivityIndicator,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { useAuthStore } from '@/store/auth.store';
import { useSocket } from '@/hooks/useSocket';
import { setOnlineStatus, updateLocation, completeTrip, driverArrived, startTrip } from '@/api/drivers';
import { COLORS } from '@/constants';

type DriverStatus = 'offline' | 'online' | 'offer' | 'assigned' | 'arriving' | 'in_progress';

export default function DriverHome() {
  const { user } = useAuthStore();
  const mapRef = useRef<MapView>(null);
  const locationInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [driverStatus, setDriverStatus] = useState<DriverStatus>('offline');
  const [pendingOffer, setPendingOffer] = useState<any>(null);
  const [activeTrip, setActiveTrip] = useState<any>(null);
  const [offerTimer, setOfferTimer] = useState(15);
  const offerTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const socket = useSocket();

  // Obtener ubicación
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({});
      setLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    })();
  }, []);

  // Eventos WebSocket del conductor
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
        // Empezar a enviar ubicación cada 5 segundos
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
      setActiveTrip(null);
      setDriverStatus('online');
      Alert.alert('¡Viaje completado!', 'El pago se procesará a la brevedad.');
    } catch { }
  };

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

      {/* Header con estado */}
      <View style={{
        position: 'absolute', top: 56, left: 16, right: 16,
        backgroundColor: COLORS.white, borderRadius: 16, padding: 16,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        elevation: 6, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8,
      }}>
        <View>
          <Text style={{ fontWeight: '700', fontSize: 16, color: COLORS.text }}>
            {user?.name?.split(' ')[0] ?? 'Conductor'}
          </Text>
          <Text style={{ fontSize: 13, color: driverStatus === 'offline' ? COLORS.muted : COLORS.success }}>
            {driverStatus === 'offline' ? '● Desconectado' : '● En línea'}
          </Text>
        </View>
        <Switch
          value={driverStatus !== 'offline'}
          onValueChange={toggleOnline}
          trackColor={{ false: COLORS.border, true: COLORS.primary }}
          disabled={driverStatus === 'offer' || driverStatus === 'in_progress'}
        />
      </View>

      {/* Panel inferior */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: COLORS.white,
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: 24, elevation: 10,
      }}>
        {/* Offline */}
        {driverStatus === 'offline' && (
          <View style={{ alignItems: 'center', paddingVertical: 8 }}>
            <Text style={{ fontSize: 40, marginBottom: 8 }}>😴</Text>
            <Text style={{ fontSize: 16, color: COLORS.textLight }}>
              Activá el switch para recibir viajes
            </Text>
          </View>
        )}

        {/* Online esperando */}
        {driverStatus === 'online' && (
          <View style={{ alignItems: 'center', paddingVertical: 8 }}>
            <ActivityIndicator color={COLORS.primary} style={{ marginBottom: 8 }} />
            <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.text }}>
              Esperando solicitudes...
            </Text>
          </View>
        )}

        {/* Viaje asignado */}
        {(driverStatus === 'assigned' || driverStatus === 'arriving') && activeTrip && (
          <View>
            <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 16 }}>
              {driverStatus === 'arriving' ? '📍 Indicá que llegaste' : '✅ Viaje asignado'}
            </Text>
            <View style={{ backgroundColor: COLORS.surface, borderRadius: 12, padding: 14, marginBottom: 16 }}>
              <Text style={{ fontWeight: '700', color: COLORS.text, marginBottom: 4 }}>
                {activeTrip.passenger?.name ?? 'Pasajero'}
              </Text>
              <Text style={{ color: COLORS.textLight, fontSize: 13 }}>📍 {activeTrip.originAddress}</Text>
              <Text style={{ color: COLORS.textLight, fontSize: 13 }}>🏁 {activeTrip.destinationAddress}</Text>
            </View>
            {driverStatus === 'assigned' && (
              <TouchableOpacity
                onPress={handleArrived}
                style={{ backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Llegué al pasajero</Text>
              </TouchableOpacity>
            )}
            {driverStatus === 'arriving' && (
              <TouchableOpacity
                onPress={handleStart}
                style={{ backgroundColor: COLORS.success, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Iniciar viaje</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* En progreso */}
        {driverStatus === 'in_progress' && activeTrip && (
          <View>
            <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 12 }}>
              🚗 Viaje en curso
            </Text>
            <Text style={{ color: COLORS.textLight, marginBottom: 20 }}>
              🏁 {activeTrip.destinationAddress}
            </Text>
            <TouchableOpacity
              onPress={handleComplete}
              style={{ backgroundColor: COLORS.success, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Completar viaje</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Modal oferta de viaje */}
      <Modal visible={driverStatus === 'offer' && !!pendingOffer} transparent animationType="slide">
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{ backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: COLORS.text }}>Nueva solicitud</Text>
              <View style={{
                width: 44, height: 44, borderRadius: 22,
                backgroundColor: offerTimer <= 5 ? '#FEF2F2' : '#EEF2FF',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ fontWeight: '800', color: offerTimer <= 5 ? COLORS.danger : COLORS.primary }}>
                  {offerTimer}
                </Text>
              </View>
            </View>

            <View style={{ backgroundColor: COLORS.surface, borderRadius: 12, padding: 16, marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                <Text style={{ color: COLORS.textLight, fontSize: 13 }}>Pasajero</Text>
                <Text style={{ fontWeight: '700', color: COLORS.text }}>
                  {pendingOffer?.passenger?.name ?? '—'} ⭐{pendingOffer?.passenger?.rating?.toFixed(1) ?? '5.0'}
                </Text>
              </View>
              <Text style={{ color: COLORS.textLight, fontSize: 13, marginBottom: 4 }}>
                📍 {pendingOffer?.originAddress}
              </Text>
              <Text style={{ color: COLORS.textLight, fontSize: 13, marginBottom: 12 }}>
                🏁 {pendingOffer?.destinationAddress}
              </Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: COLORS.textLight, fontSize: 13 }}>
                  {pendingOffer?.paymentMethod === 'cash' ? '💵 Efectivo' : '📱 Mercado Pago'}
                </Text>
                <Text style={{ fontSize: 20, fontWeight: '800', color: COLORS.text }}>
                  ${pendingOffer?.estimatedPrice?.toFixed(2) ?? '—'}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={handleReject}
                style={{ flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center', backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' }}
              >
                <Text style={{ color: COLORS.danger, fontWeight: '700', fontSize: 16 }}>Rechazar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleAccept}
                style={{ flex: 2, borderRadius: 12, paddingVertical: 14, alignItems: 'center', backgroundColor: COLORS.primary }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Aceptar viaje</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
