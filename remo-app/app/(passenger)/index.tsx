import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, FlatList,
  StatusBar, Platform, Keyboard,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, MapPressEvent } from 'react-native-maps';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/auth.store';
import { createTrip, cancelTrip, devAcceptTrip, Trip } from '@/api/trips';
import { useSocket } from '@/hooks/useSocket';
import { COLORS } from '@/constants';

type AppStatus = 'idle' | 'searching' | 'assigned' | 'arriving' | 'in_progress' | 'completed';
type PlaceSuggestion = { place_id: string; display_name: string; lat: string; lon: string };

export default function PassengerHome() {
  const { user } = useAuthStore();
  const mapRef = useRef<MapView>(null);
  const inputRef = useRef<TextInput>(null);
  const insets = useSafeAreaInsets();

  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [destination, setDestination] = useState('');
  const [destinationCoords, setDestinationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mercado_pago'>('cash');
  const [status, setStatus] = useState<AppStatus>('idle');
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [driverInfo, setDriverInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const socket = useSocket();

  // Ubicación GPS
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
        latitude: coords.lat, longitude: coords.lng,
        latitudeDelta: 0.012, longitudeDelta: 0.012,
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
        Alert.alert('Sin conductores', 'No hay conductores disponibles. Intentá en unos minutos.');
    });
    socket.on('trip:driver_arriving', () => setStatus('arriving'));
    socket.on('trip:started', () => setStatus('in_progress'));
    socket.on('trip:completed', () => setStatus('completed'));
    return () => {
      ['trip:searching','trip:driver_assigned','trip:cancelled',
       'trip:driver_arriving','trip:started','trip:completed'].forEach(e => socket.off(e));
    };
  }, [socket]);

  // Búsqueda de texto con Nominatim (debounced)
  const handleDestinationChange = (text: string) => {
    setDestination(text);
    setDestinationCoords(null);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (text.length < 3) { setSuggestions([]); return; }
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
        setShowSuggestions(true);
      } catch { /* sin internet */ }
      finally { setSearching(false); }
    }, 600);
  };

  // Geocodificación inversa al tocar el mapa
  const handleMapPress = async (e: MapPressEvent) => {
    if (status !== 'idle') return;
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setDestinationCoords({ lat: latitude, lng: longitude });
    setShowSuggestions(false);
    setSuggestions([]);
    Keyboard.dismiss();
    setDestination('Cargando dirección...');
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
        { headers: { 'User-Agent': 'REMO-App/1.0' } }
      );
      const data = await res.json();
      setDestination(data.display_name ?? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
    } catch {
      setDestination(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
    }
  };

  const selectSuggestion = (item: PlaceSuggestion) => {
    const coords = { lat: parseFloat(item.lat), lng: parseFloat(item.lon) };
    setDestination(item.display_name);
    setDestinationCoords(coords);
    setSuggestions([]);
    setShowSuggestions(false);
    Keyboard.dismiss();
    mapRef.current?.animateToRegion({
      latitude: coords.lat, longitude: coords.lng,
      latitudeDelta: 0.012, longitudeDelta: 0.012,
    }, 600);
  };

  const clearDestination = () => {
    setDestination('');
    setDestinationCoords(null);
    setSuggestions([]);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleRequestTrip = async () => {
    if (!location) return Alert.alert('Sin ubicación', 'Esperá a que detectemos tu posición.');
    if (!destinationCoords) return Alert.alert('Destino', 'Elegí un destino en el mapa o buscá una dirección.');
    Keyboard.dismiss();
    setLoading(true);
    try {
      const { data } = await createTrip({
        originLat: location.lat, originLng: location.lng,
        destinationLat: destinationCoords.lat, destinationLng: destinationCoords.lng,
        originAddress: 'Mi ubicación', destinationAddress: destination,
        paymentMethod,
      });
      setActiveTrip(data);
      setStatus('searching');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message ?? 'No se pudo solicitar el viaje.');
    } finally { setLoading(false); }
  };

  const handleCancel = async () => {
    setStatus('idle'); setActiveTrip(null); setDriverInfo(null);
    if (activeTrip) { try { await cancelTrip(activeTrip.id); } catch { /* ya cancelado */ } }
  };

  const topOffset = insets.top + (Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0);

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />

      {/* Mapa */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={{ flex: 1 }}
        showsUserLocation
        showsMyLocationButton={false}
        onPress={handleMapPress}
        initialRegion={{ latitude: -24.7821, longitude: -65.4232, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
      >
        {destinationCoords && (
          <Marker
            coordinate={{ latitude: destinationCoords.lat, longitude: destinationCoords.lng }}
            title="Destino"
            pinColor={COLORS.primary}
          />
        )}
        {driverInfo?.driver && (
          <Marker
            coordinate={{ latitude: driverInfo.driver.lat ?? 0, longitude: driverInfo.driver.lng ?? 0 }}
            title={driverInfo.driver.name}
          />
        )}
      </MapView>

      {/* Barra de búsqueda — fija arriba del mapa */}
      {status === 'idle' && (
        <View style={{
          position: 'absolute', top: topOffset + 8, left: 16, right: 16, zIndex: 10,
        }}>
          {/* Input */}
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: COLORS.white, borderRadius: 14,
            paddingHorizontal: 14, paddingVertical: 4,
            elevation: 6, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8,
          }}>
            <Text style={{ fontSize: 18, marginRight: 8 }}>📍</Text>
            <TextInput
              ref={inputRef}
              placeholder="¿A dónde vas?"
              placeholderTextColor={COLORS.muted}
              value={destination}
              onChangeText={handleDestinationChange}
              onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
              style={{ flex: 1, fontSize: 16, color: COLORS.text, paddingVertical: 12 }}
              returnKeyType="search"
            />
            {searching && <ActivityIndicator size="small" color={COLORS.primary} style={{ marginLeft: 8 }} />}
            {destination.length > 0 && !searching && (
              <TouchableOpacity onPress={clearDestination} style={{ padding: 4 }}>
                <Text style={{ fontSize: 18, color: COLORS.muted }}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Sugerencias — aparecen justo debajo del input */}
          {showSuggestions && suggestions.length > 0 && (
            <View style={{
              backgroundColor: COLORS.white, borderRadius: 14, marginTop: 6,
              elevation: 8, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8,
              maxHeight: 260,
            }}>
              <FlatList
                data={suggestions}
                keyExtractor={(item) => item.place_id}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item, index }) => (
                  <TouchableOpacity
                    onPress={() => selectSuggestion(item)}
                    style={{
                      flexDirection: 'row', alignItems: 'center',
                      padding: 14,
                      borderBottomWidth: index < suggestions.length - 1 ? 1 : 0,
                      borderColor: COLORS.border,
                    }}
                  >
                    <Text style={{ fontSize: 16, marginRight: 10 }}>📍</Text>
                    <Text style={{ flex: 1, fontSize: 13, color: COLORS.text }} numberOfLines={2}>
                      {item.display_name}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          )}

          {/* Hint toque mapa */}
          {!destinationCoords && destination.length === 0 && (
            <View style={{
              backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 10,
              paddingHorizontal: 12, paddingVertical: 7, marginTop: 8, alignSelf: 'center',
            }}>
              <Text style={{ color: '#fff', fontSize: 12 }}>
                Buscá una dirección o tocá el mapa para elegir destino
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Botón centrar en mi ubicación */}
      {status === 'idle' && location && (
        <TouchableOpacity
          onPress={() => mapRef.current?.animateToRegion({
            latitude: location.lat, longitude: location.lng,
            latitudeDelta: 0.012, longitudeDelta: 0.012,
          }, 500)}
          style={{
            position: 'absolute', right: 16, bottom: destinationCoords ? 230 : 120,
            width: 46, height: 46, borderRadius: 23,
            backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center',
            elevation: 5, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6,
          }}
        >
          <Text style={{ fontSize: 22 }}>◎</Text>
        </TouchableOpacity>
      )}

      {/* Panel inferior — solo cuando hay destino seleccionado o estado activo */}
      {(destinationCoords || status !== 'idle') && (
        <View style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          backgroundColor: COLORS.white,
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          paddingHorizontal: 24, paddingTop: 20,
          paddingBottom: insets.bottom + 16,
          elevation: 12, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12,
        }}>

          {/* Confirmación de viaje */}
          {status === 'idle' && destinationCoords && (
            <>
              <Text style={{ fontSize: 13, color: COLORS.textLight, marginBottom: 4 }}>Destino</Text>
              <Text style={{ fontSize: 15, fontWeight: '600', color: COLORS.text, marginBottom: 16 }} numberOfLines={2}>
                {destination}
              </Text>

              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                {(['cash', 'mercado_pago'] as const).map((m) => (
                  <TouchableOpacity
                    key={m}
                    onPress={() => setPaymentMethod(m)}
                    style={{
                      flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5,
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

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  onPress={clearDestination}
                  style={{
                    flex: 1, paddingVertical: 15, borderRadius: 12, borderWidth: 1.5,
                    borderColor: COLORS.border, alignItems: 'center',
                  }}
                >
                  <Text style={{ color: COLORS.text, fontWeight: '600' }}>Cambiar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleRequestTrip}
                  disabled={loading}
                  style={{
                    flex: 2, backgroundColor: COLORS.primary, borderRadius: 12,
                    paddingVertical: 15, alignItems: 'center', opacity: loading ? 0.7 : 1,
                  }}
                >
                  {loading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Solicitar viaje</Text>
                  }
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Buscando */}
          {status === 'searching' && (
            <View style={{ alignItems: 'center', paddingVertical: 8 }}>
              <ActivityIndicator color={COLORS.primary} size="large" style={{ marginBottom: 14 }} />
              <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 6 }}>
                Buscando conductor...
              </Text>
              <Text style={{ color: COLORS.textLight, marginBottom: 20, textAlign: 'center' }}>
                Estamos encontrando el mejor conductor cerca tuyo.
              </Text>
              <TouchableOpacity
                onPress={async () => {
                  if (!activeTrip) return;
                  try { await devAcceptTrip(activeTrip.id); }
                  catch (e: any) { Alert.alert('Dev', e.response?.data?.message ?? 'Error'); }
                }}
                style={{
                  backgroundColor: '#7C3AED', borderRadius: 10,
                  paddingVertical: 12, paddingHorizontal: 24, marginBottom: 14,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>🧪 Simular conductor</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleCancel}>
                <Text style={{ color: COLORS.danger, fontWeight: '600' }}>Cancelar viaje</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Conductor asignado / llegando */}
          {(status === 'assigned' || status === 'arriving') && driverInfo && (
            <View>
              <Text style={{ fontSize: 17, fontWeight: '700', color: COLORS.text, marginBottom: 14 }}>
                {status === 'arriving' ? '📍 Tu conductor está llegando' : '✅ Conductor en camino'}
              </Text>
              <View style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: COLORS.surface, borderRadius: 14, padding: 14, marginBottom: 12,
              }}>
                <View style={{
                  width: 50, height: 50, borderRadius: 25,
                  backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginRight: 12,
                }}>
                  <Text style={{ fontSize: 22 }}>👤</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text }}>
                    {driverInfo.driver?.name ?? '—'}
                  </Text>
                  <Text style={{ color: COLORS.textLight, fontSize: 13 }}>
                    ⭐ {Number(driverInfo.driver?.rating ?? 5).toFixed(1)}
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

          {/* En curso */}
          {status === 'in_progress' && (
            <View style={{ alignItems: 'center', paddingVertical: 8 }}>
              <Text style={{ fontSize: 36, marginBottom: 8 }}>🚗</Text>
              <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.text }}>Viaje en curso</Text>
              <Text style={{ color: COLORS.textLight, marginTop: 4 }} numberOfLines={1}>
                {activeTrip?.destinationAddress}
              </Text>
            </View>
          )}

          {/* Completado */}
          {status === 'completed' && (
            <View style={{ alignItems: 'center', paddingVertical: 8 }}>
              <Text style={{ fontSize: 36, marginBottom: 8 }}>🎉</Text>
              <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 4 }}>¡Llegaste!</Text>
              <Text style={{ color: COLORS.textLight, marginBottom: 20 }}>¿Cómo fue tu viaje?</Text>
              <TouchableOpacity
                onPress={() => { setStatus('idle'); setActiveTrip(null); setDriverInfo(null); setDestinationCoords(null); setDestination(''); }}
                style={{ backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32 }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>Calificar y cerrar</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
