import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, FlatList,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { useAuthStore } from '@/store/auth.store';
import { createTrip, cancelTrip, devAcceptTrip, Trip } from '@/api/trips';
import { useSocket } from '@/hooks/useSocket';
import { COLORS } from '@/constants';

type AppStatus =
  | 'idle'
  | 'searching'
  | 'assigned'
  | 'arriving'
  | 'in_progress'
  | 'completed';

type PlaceSuggestion = {
  place_id: string;
  display_name: string;
  lat: string;
  lon: string;
};

export default function PassengerHome() {
  const { user } = useAuthStore();
  const mapRef = useRef<MapView>(null);

  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [destination, setDestination] = useState('');
  const [destinationCoords, setDestinationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mercado_pago'>('cash');
  const [status, setStatus] = useState<AppStatus>('idle');
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [driverInfo, setDriverInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const socket = useSocket();

  // Obtener ubicación actual
  useEffect(() => {
    (async () => {
      const { status: perm } = await Location.requestForegroundPermissionsAsync();
      if (perm !== 'granted') {
        Alert.alert('Permiso necesario', 'Necesitamos tu ubicación para el servicio.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      setLocation(coords);
      mapRef.current?.animateToRegion({
        latitude: coords.lat,
        longitude: coords.lng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 800);
    })();
  }, []);

  // WebSocket
  useEffect(() => {
    if (!socket) return;
    socket.on('trip:searching', () => setStatus('searching'));
    socket.on('trip:driver_assigned', (data: any) => { setDriverInfo(data); setStatus('assigned'); });
    socket.on('trip:cancelled', (data: any) => {
      setStatus('idle'); setActiveTrip(null); setDriverInfo(null);
      if (data.reason === 'no_drivers_available')
        Alert.alert('Sin conductores', 'No hay conductores disponibles cerca. Intentá en unos minutos.');
    });
    socket.on('trip:driver_arriving', () => setStatus('arriving'));
    socket.on('trip:started', () => setStatus('in_progress'));
    socket.on('trip:completed', () => setStatus('completed'));
    return () => {
      ['trip:searching','trip:driver_assigned','trip:cancelled',
       'trip:driver_arriving','trip:started','trip:completed'].forEach(e => socket.off(e));
    };
  }, [socket]);

  // Búsqueda de direcciones con Nominatim (debounced 600ms)
  const handleDestinationChange = (text: string) => {
    setDestination(text);
    setDestinationCoords(null);
    setSuggestions([]);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (text.length < 3) return;
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const q = encodeURIComponent(`${text}, Salta, Argentina`);
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=5&countrycodes=ar`,
          { headers: { 'User-Agent': 'REMO-App/1.0' } }
        );
        const data: PlaceSuggestion[] = await res.json();
        setSuggestions(data);
      } catch {
        // sin internet o error — ignorar
      } finally {
        setSearching(false);
      }
    }, 600);
  };

  const selectSuggestion = (item: PlaceSuggestion) => {
    const coords = { lat: parseFloat(item.lat), lng: parseFloat(item.lon) };
    setDestination(item.display_name);
    setDestinationCoords(coords);
    setSuggestions([]);
    mapRef.current?.animateToRegion({
      latitude: coords.lat,
      longitude: coords.lng,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    }, 600);
  };

  const handleRequestTrip = async () => {
    if (!location) return Alert.alert('Sin ubicación', 'Esperá a que detectemos tu posición.');
    if (!destination.trim()) return Alert.alert('Destino', 'Ingresá el destino.');
    if (!destinationCoords) return Alert.alert('Destino', 'Seleccioná una dirección de la lista.');

    setLoading(true);
    try {
      const { data } = await createTrip({
        originLat: location.lat,
        originLng: location.lng,
        destinationLat: destinationCoords.lat,
        destinationLng: destinationCoords.lng,
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
    // Resetear frontend de inmediato; luego intentar cancelar en el backend
    setStatus('idle'); setActiveTrip(null); setDriverInfo(null);
    if (activeTrip) {
      try { await cancelTrip(activeTrip.id); } catch { /* ya cancelado */ }
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
        showsMyLocationButton
        initialRegion={{ latitude: -24.7821, longitude: -65.4232, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
      >
        {destinationCoords && (
          <Marker
            coordinate={{ latitude: destinationCoords.lat, longitude: destinationCoords.lng }}
            title="Destino"
            pinColor={COLORS.primary}
          />
        )}
        {driverInfo && (
          <Marker
            coordinate={{ latitude: driverInfo.driver?.lat ?? 0, longitude: driverInfo.driver?.lng ?? 0 }}
            title={driverInfo.driver?.name}
            description={driverInfo.vehicle?.plate}
          />
        )}
      </MapView>

      {/* Panel inferior */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'position' : 'height'}
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}
      >
        <View
          style={{
            backgroundColor: COLORS.white,
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            padding: 24, elevation: 10,
            shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10,
          }}
        >
          {status === 'idle' && (
            <>
              <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 16 }}>
                Hola, {user?.name?.split(' ')[0] ?? 'bienvenido'} 👋
              </Text>

              {/* Input destino */}
              <View style={{ marginBottom: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center',
                  borderWidth: 1.5, borderColor: destinationCoords ? COLORS.primary : COLORS.border,
                  borderRadius: 12, paddingHorizontal: 16, paddingVertical: 4,
                  backgroundColor: COLORS.surface,
                }}>
                  <TextInput
                    placeholder="¿A dónde vas?"
                    placeholderTextColor={COLORS.muted}
                    value={destination}
                    onChangeText={handleDestinationChange}
                    style={{ flex: 1, fontSize: 16, color: COLORS.text, paddingVertical: 10 }}
                    returnKeyType="search"
                  />
                  {searching && <ActivityIndicator size="small" color={COLORS.primary} />}
                  {destination.length > 0 && !searching && (
                    <TouchableOpacity onPress={() => { setDestination(''); setDestinationCoords(null); setSuggestions([]); }}>
                      <Text style={{ fontSize: 18, color: COLORS.muted, paddingLeft: 8 }}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Lista de sugerencias */}
                {suggestions.length > 0 && (
                  <View style={{
                    backgroundColor: COLORS.white, borderRadius: 12, elevation: 8,
                    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8,
                    marginTop: 4, maxHeight: 200,
                  }}>
                    <FlatList
                      data={suggestions}
                      keyExtractor={(item) => item.place_id}
                      keyboardShouldPersistTaps="handled"
                      renderItem={({ item, index }) => (
                        <TouchableOpacity
                          onPress={() => selectSuggestion(item)}
                          style={{
                            padding: 14,
                            borderBottomWidth: index < suggestions.length - 1 ? 1 : 0,
                            borderColor: COLORS.border,
                          }}
                        >
                          <Text style={{ fontSize: 13, color: COLORS.text }} numberOfLines={2}>
                            📍 {item.display_name}
                          </Text>
                        </TouchableOpacity>
                      )}
                    />
                  </View>
                )}
              </View>

              {/* Método de pago */}
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16, marginTop: 12 }}>
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
                disabled={loading || !destinationCoords}
                style={{
                  backgroundColor: destinationCoords ? COLORS.primary : COLORS.muted,
                  borderRadius: 12, paddingVertical: 16, alignItems: 'center',
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

          {status === 'searching' && (
            <View style={{ alignItems: 'center', paddingVertical: 16 }}>
              <ActivityIndicator color={COLORS.primary} size="large" style={{ marginBottom: 16 }} />
              <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 8 }}>
                Buscando conductor...
              </Text>
              <Text style={{ color: COLORS.textLight, marginBottom: 24 }}>
                Estamos encontrando el mejor conductor cerca tuyo.
              </Text>

              {/* Botón dev — simula aceptación del conductor de prueba */}
              <TouchableOpacity
                onPress={async () => {
                  if (!activeTrip) return;
                  try { await devAcceptTrip(activeTrip.id); } catch (e: any) {
                    Alert.alert('Dev', e.response?.data?.message ?? 'Error');
                  }
                }}
                style={{
                  backgroundColor: '#7C3AED', borderRadius: 10,
                  paddingVertical: 12, paddingHorizontal: 24, marginBottom: 16,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>🧪 Simular conductor</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleCancel}>
                <Text style={{ color: COLORS.danger, fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          )}

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
                  backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginRight: 12,
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
                  Llega en aproximadamente{' '}
                  <Text style={{ fontWeight: '700', color: COLORS.text }}>{driverInfo.etaMinutes} min</Text>
                </Text>
              )}
              <TouchableOpacity onPress={handleCancel}>
                <Text style={{ color: COLORS.danger, fontWeight: '600', textAlign: 'center' }}>Cancelar viaje</Text>
              </TouchableOpacity>
            </View>
          )}

          {status === 'in_progress' && (
            <View style={{ alignItems: 'center', paddingVertical: 16 }}>
              <Text style={{ fontSize: 40, marginBottom: 8 }}>🚗</Text>
              <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.text }}>Viaje en curso</Text>
              <Text style={{ color: COLORS.textLight, marginTop: 4 }}>{activeTrip?.destinationAddress}</Text>
            </View>
          )}

          {status === 'completed' && (
            <View style={{ alignItems: 'center', paddingVertical: 16 }}>
              <Text style={{ fontSize: 40, marginBottom: 8 }}>🎉</Text>
              <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 4 }}>¡Llegaste!</Text>
              <Text style={{ color: COLORS.textLight, marginBottom: 24 }}>¿Cómo fue tu viaje?</Text>
              <TouchableOpacity
                onPress={() => { setStatus('idle'); setActiveTrip(null); setDriverInfo(null); }}
                style={{ backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32 }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>Calificar y cerrar</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
