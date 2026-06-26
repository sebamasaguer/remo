import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, ScrollView, Modal,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { useAuthStore } from '@/store/auth.store';
import { createTrip, cancelTrip, Trip } from '@/api/trips';
import { useSocket } from '@/hooks/useSocket';
import { COLORS } from '@/constants';

type AppStatus =
  | 'idle'           // ingresando destino
  | 'searching'      // buscando conductor
  | 'assigned'       // conductor asignado, en camino
  | 'arriving'       // conductor llegando
  | 'in_progress'    // viaje en curso
  | 'completed';     // viaje terminado

export default function PassengerHome() {
  const { user } = useAuthStore();
  const mapRef = useRef<MapView>(null);

  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [destination, setDestination] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mercado_pago'>('cash');
  const [status, setStatus] = useState<AppStatus>('idle');
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [driverInfo, setDriverInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const socket = useSocket();

  // Obtener ubicación actual
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso necesario', 'Necesitamos tu ubicación para el servicio.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    })();
  }, []);

  // Eventos WebSocket
  useEffect(() => {
    if (!socket) return;

    socket.on('trip:searching', () => setStatus('searching'));

    socket.on('trip:driver_assigned', (data: any) => {
      setDriverInfo(data);
      setStatus('assigned');
    });

    socket.on('trip:cancelled', (data: any) => {
      setStatus('idle');
      setActiveTrip(null);
      setDriverInfo(null);
      if (data.reason === 'no_drivers_available') {
        Alert.alert('Sin conductores', 'No hay conductores disponibles cerca. Intentá en unos minutos.');
      }
    });

    socket.on('trip:driver_arriving', () => setStatus('arriving'));
    socket.on('trip:started', () => setStatus('in_progress'));
    socket.on('trip:completed', () => setStatus('completed'));

    return () => {
      socket.off('trip:searching');
      socket.off('trip:driver_assigned');
      socket.off('trip:cancelled');
      socket.off('trip:driver_arriving');
      socket.off('trip:started');
      socket.off('trip:completed');
    };
  }, [socket]);

  const handleRequestTrip = async () => {
    if (!location) return Alert.alert('Sin ubicación', 'Esperá a que detectemos tu posición.');
    if (!destination.trim()) return Alert.alert('Destino', 'Ingresá el destino.');

    setLoading(true);
    try {
      const { data } = await createTrip({
        originLat: location.lat,
        originLng: location.lng,
        // Por simplificación usamos coordenadas ficticias para el destino
        // En producción integrás Google Places API
        destinationLat: location.lat - 0.01,
        destinationLng: location.lng - 0.01,
        originAddress: 'Mi ubicación',
        destinationAddress: destination,
        paymentMethod,
      });
      setActiveTrip(data);
      setStatus('searching');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message ?? 'No se pudo solicitar el viaje.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!activeTrip) return;
    try {
      await cancelTrip(activeTrip.id);
      setStatus('idle');
      setActiveTrip(null);
      setDriverInfo(null);
    } catch {
      Alert.alert('Error', 'No se pudo cancelar el viaje.');
    }
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
      >
        {driverInfo && (
          <Marker
            coordinate={{ latitude: driverInfo.driver?.lat ?? 0, longitude: driverInfo.driver?.lng ?? 0 }}
            title={driverInfo.driver?.name}
            description={driverInfo.vehicle?.plate}
          />
        )}
      </MapView>

      {/* Panel inferior */}
      <View
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          backgroundColor: COLORS.white,
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          padding: 24, elevation: 10,
          shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10,
        }}
      >
        {/* Saludo */}
        {status === 'idle' && (
          <>
            <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 16 }}>
              Hola, {user?.name?.split(' ')[0] ?? 'bienvenido'} 👋
            </Text>

            <TextInput
              placeholder="¿A dónde vas?"
              placeholderTextColor={COLORS.muted}
              value={destination}
              onChangeText={setDestination}
              style={{
                borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12,
                paddingHorizontal: 16, paddingVertical: 12, fontSize: 16,
                color: COLORS.text, backgroundColor: COLORS.surface, marginBottom: 12,
              }}
            />

            {/* Método de pago */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              {(['cash', 'mercado_pago'] as const).map((m) => (
                <TouchableOpacity
                  key={m}
                  onPress={() => setPaymentMethod(m)}
                  style={{
                    flex: 1, paddingVertical: 10, borderRadius: 10,
                    borderWidth: 1.5,
                    borderColor: paymentMethod === m ? COLORS.primary : COLORS.border,
                    backgroundColor: paymentMethod === m ? '#EEF2FF' : COLORS.surface,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '600', color: paymentMethod === m ? COLORS.primary : COLORS.textLight }}>
                    {m === 'cash' ? '💵 Efectivo' : '📱 Mercado Pago'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              onPress={handleRequestTrip}
              disabled={loading}
              style={{
                backgroundColor: COLORS.primary, borderRadius: 12,
                paddingVertical: 16, alignItems: 'center',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Solicitar viaje</Text>
              }
            </TouchableOpacity>
          </>
        )}

        {/* Buscando conductor */}
        {status === 'searching' && (
          <View style={{ alignItems: 'center', paddingVertical: 16 }}>
            <ActivityIndicator color={COLORS.primary} size="large" style={{ marginBottom: 16 }} />
            <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 8 }}>
              Buscando conductor...
            </Text>
            <Text style={{ color: COLORS.textLight, marginBottom: 24 }}>
              Estamos encontrando el mejor conductor cerca tuyo.
            </Text>
            <TouchableOpacity onPress={handleCancel}>
              <Text style={{ color: COLORS.danger, fontWeight: '600' }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Conductor asignado */}
        {(status === 'assigned' || status === 'arriving') && driverInfo && (
          <View style={{ paddingVertical: 8 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 16 }}>
              {status === 'arriving' ? '📍 Tu conductor está llegando' : '✅ Conductor en camino'}
            </Text>

            <View style={{
              flexDirection: 'row', alignItems: 'center',
              backgroundColor: COLORS.surface, borderRadius: 12, padding: 16, marginBottom: 12,
            }}>
              <View style={{
                width: 52, height: 52, borderRadius: 26,
                backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
                marginRight: 12,
              }}>
                <Text style={{ fontSize: 24 }}>👤</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text }}>
                  {driverInfo.driver?.name ?? '—'}
                </Text>
                <Text style={{ color: COLORS.textLight, fontSize: 13 }}>
                  ⭐ {driverInfo.driver?.rating?.toFixed(1) ?? '5.0'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.primary }}>
                  {driverInfo.vehicle?.plate}
                </Text>
                <Text style={{ color: COLORS.textLight, fontSize: 12 }}>
                  {driverInfo.vehicle?.color} {driverInfo.vehicle?.brand}
                </Text>
              </View>
            </View>

            {driverInfo.etaMinutes && (
              <Text style={{ color: COLORS.textLight, textAlign: 'center', marginBottom: 12 }}>
                Llega en aproximadamente <Text style={{ fontWeight: '700', color: COLORS.text }}>{driverInfo.etaMinutes} min</Text>
              </Text>
            )}

            <TouchableOpacity onPress={handleCancel}>
              <Text style={{ color: COLORS.danger, fontWeight: '600', textAlign: 'center' }}>Cancelar viaje</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Viaje en curso */}
        {status === 'in_progress' && (
          <View style={{ alignItems: 'center', paddingVertical: 16 }}>
            <Text style={{ fontSize: 40, marginBottom: 8 }}>🚗</Text>
            <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.text }}>
              Viaje en curso
            </Text>
            <Text style={{ color: COLORS.textLight, marginTop: 4 }}>
              {activeTrip?.destinationAddress}
            </Text>
          </View>
        )}

        {/* Viaje completado */}
        {status === 'completed' && (
          <View style={{ alignItems: 'center', paddingVertical: 16 }}>
            <Text style={{ fontSize: 40, marginBottom: 8 }}>🎉</Text>
            <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 4 }}>
              ¡Llegaste!
            </Text>
            <Text style={{ color: COLORS.textLight, marginBottom: 24 }}>
              ¿Cómo fue tu viaje?
            </Text>
            <TouchableOpacity
              onPress={() => { setStatus('idle'); setActiveTrip(null); setDriverInfo(null); }}
              style={{
                backgroundColor: COLORS.primary, borderRadius: 12,
                paddingVertical: 14, paddingHorizontal: 32,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>Calificar y cerrar</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}
