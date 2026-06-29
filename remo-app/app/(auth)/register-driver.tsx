import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/auth.store';
import { registerDriver, getRemiseras } from '@/api/drivers';
import { COLORS } from '@/constants';

type DriverType = 'independent' | 'remisera';

interface Remisera { id: string; name: string }

export default function RegisterDriverScreen() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();

  const [step, setStep] = useState<1 | 2>(1);
  const [driverType, setDriverType] = useState<DriverType | null>(null);
  const [remiseras, setRemiseras] = useState<Remisera[]>([]);
  const [selectedRemisera, setSelectedRemisera] = useState<string | null>(null);
  const [loadingRemiseras, setLoadingRemiseras] = useState(false);

  const [plate, setPlate] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [color, setColor] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchRemiseras = async () => {
    setLoadingRemiseras(true);
    try {
      const { data } = await getRemiseras();
      setRemiseras(data);
    } catch {
      Alert.alert('Error', 'No se pudo cargar la lista de remiseras.');
    } finally {
      setLoadingRemiseras(false);
    }
  };

  const handleSelectType = (type: DriverType) => {
    setDriverType(type);
    setSelectedRemisera(null);
    if (type === 'remisera' && remiseras.length === 0) fetchRemiseras();
  };

  const handleNext = () => {
    if (!driverType) {
      Alert.alert('Seleccioná un tipo', 'Indicá si sos independiente o pertenecés a una remisera.');
      return;
    }
    if (driverType === 'remisera' && !selectedRemisera) {
      Alert.alert('Seleccioná una remisera', 'Indicá a qué remisera pertenecés.');
      return;
    }
    setStep(2);
  };

  const handleSubmit = async () => {
    const plateTrimmed = plate.trim().toUpperCase().replace(/\s/g, '');
    if (!/^[A-Z0-9]{6,7}$/.test(plateTrimmed)) {
      Alert.alert('Patente inválida', 'Ingresá una patente válida (6 o 7 caracteres, ej: ABC123 o AD123BF).');
      return;
    }
    if (!brand.trim()) { Alert.alert('Falta la marca', 'Ingresá la marca del vehículo.'); return; }
    if (!model.trim()) { Alert.alert('Falta el modelo', 'Ingresá el modelo del vehículo.'); return; }
    const yearNum = parseInt(year.trim(), 10);
    if (!/^\d{4}$/.test(year.trim()) || yearNum < 1990 || yearNum > new Date().getFullYear()) {
      Alert.alert('Año inválido', `Ingresá un año entre 1990 y ${new Date().getFullYear()}.`);
      return;
    }
    if (!color.trim()) { Alert.alert('Falta el color', 'Ingresá el color del vehículo.'); return; }

    setSubmitting(true);
    try {
      await registerDriver({
        type: driverType!,
        remiseraId: selectedRemisera ?? undefined,
        plate: plateTrimmed,
        brand: brand.trim(),
        model: model.trim(),
        year: year.trim(),
        color: color.trim(),
      });

      if (user) setUser({ ...user, role: 'driver' });
      router.replace('/(driver)');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message ?? 'No se pudo completar el registro.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: COLORS.white }}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={{ paddingTop: 56, paddingHorizontal: 24, paddingBottom: 8 }}>
          <TouchableOpacity
            onPress={() => (step === 1 ? router.back() : setStep(1))}
            style={{ marginBottom: 24 }}
          >
            <Text style={{ fontSize: 24, color: COLORS.text }}>←</Text>
          </TouchableOpacity>

          {/* Barra de progreso */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 28 }}>
            {([1, 2] as const).map((s) => (
              <View
                key={s}
                style={{
                  flex: 1, height: 4, borderRadius: 2,
                  backgroundColor: s <= step ? COLORS.primary : COLORS.border,
                }}
              />
            ))}
          </View>

          <Text style={{ fontSize: 26, fontWeight: '800', color: COLORS.text }}>
            {step === 1 ? 'Tipo de conductor' : 'Datos del vehículo'}
          </Text>
          <Text style={{ fontSize: 14, color: COLORS.textLight, marginTop: 4, marginBottom: 28 }}>
            {step === 1
              ? 'Contanos cómo vas a trabajar con REMO.'
              : 'Ingresá los datos del auto con el que vas a operar.'}
          </Text>
        </View>

        <View style={{ paddingHorizontal: 24, paddingBottom: 48 }}>
          {/* ── Paso 1: Tipo ── */}
          {step === 1 && (
            <>
              {(['independent', 'remisera'] as DriverType[]).map((type) => {
                const selected = driverType === type;
                return (
                  <TouchableOpacity
                    key={type}
                    onPress={() => handleSelectType(type)}
                    style={{
                      borderWidth: 2,
                      borderColor: selected ? COLORS.primary : COLORS.border,
                      borderRadius: 16,
                      padding: 20,
                      marginBottom: 12,
                      backgroundColor: selected ? '#EEF2FF' : COLORS.surface,
                    }}
                  >
                    <Text style={{ fontSize: 32, marginBottom: 10 }}>
                      {type === 'independent' ? '🚗' : '🏢'}
                    </Text>
                    <Text style={{ fontSize: 17, fontWeight: '700', color: COLORS.text, marginBottom: 4 }}>
                      {type === 'independent' ? 'Independiente' : 'Pertenezco a una remisera'}
                    </Text>
                    <Text style={{ fontSize: 13, color: COLORS.textLight, lineHeight: 18 }}>
                      {type === 'independent'
                        ? 'Trabajo por mi cuenta, sin estar asociado a ninguna empresa.'
                        : 'Estoy afiliado a una empresa de remises registrada en REMO.'}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              {driverType === 'remisera' && (
                <View style={{ marginTop: 8, marginBottom: 4 }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: COLORS.text, marginBottom: 12 }}>
                    Seleccioná tu remisera
                  </Text>
                  {loadingRemiseras ? (
                    <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 16 }} />
                  ) : remiseras.length === 0 ? (
                    <Text style={{ color: COLORS.textLight, fontSize: 14, textAlign: 'center', marginVertical: 16 }}>
                      No hay remiseras disponibles en este momento.
                    </Text>
                  ) : (
                    remiseras.map((r) => {
                      const sel = selectedRemisera === r.id;
                      return (
                        <TouchableOpacity
                          key={r.id}
                          onPress={() => setSelectedRemisera(r.id)}
                          style={{
                            flexDirection: 'row', alignItems: 'center',
                            padding: 14, borderRadius: 12, marginBottom: 8,
                            borderWidth: 1.5,
                            borderColor: sel ? COLORS.primary : COLORS.border,
                            backgroundColor: sel ? '#EEF2FF' : COLORS.white,
                          }}
                        >
                          <Text style={{
                            flex: 1, fontSize: 15, color: COLORS.text,
                            fontWeight: sel ? '600' : '400',
                          }}>
                            {r.name}
                          </Text>
                          {sel && <Text style={{ color: COLORS.primary, fontSize: 18 }}>✓</Text>}
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>
              )}

              <TouchableOpacity
                onPress={handleNext}
                style={{
                  backgroundColor: COLORS.primary, borderRadius: 12,
                  paddingVertical: 16, alignItems: 'center', marginTop: 20,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Continuar</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── Paso 2: Vehículo ── */}
          {step === 2 && (
            <>
              {[
                {
                  label: 'Patente', hint: '6 o 7 caracteres',
                  value: plate,
                  setter: (v: string) => setPlate(v.toUpperCase()),
                  placeholder: 'Ej: ABC123',
                  autoCapitalize: 'characters' as const,
                },
                {
                  label: 'Marca', value: brand, setter: setBrand,
                  placeholder: 'Ej: Volkswagen',
                },
                {
                  label: 'Modelo', value: model, setter: setModel,
                  placeholder: 'Ej: Gol Trend',
                },
                {
                  label: 'Año', value: year, setter: setYear,
                  placeholder: 'Ej: 2019',
                  keyboardType: 'number-pad' as const,
                  maxLength: 4,
                },
                {
                  label: 'Color', value: color, setter: setColor,
                  placeholder: 'Ej: Blanco',
                },
              ].map((field) => (
                <View key={field.label} style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.textLight, marginBottom: 6, letterSpacing: 0.5 }}>
                    {field.label.toUpperCase()}
                    {field.hint ? <Text style={{ fontWeight: '400' }}> · {field.hint}</Text> : null}
                  </Text>
                  <TextInput
                    value={field.value}
                    onChangeText={field.setter}
                    placeholder={field.placeholder}
                    placeholderTextColor={COLORS.muted}
                    keyboardType={field.keyboardType ?? 'default'}
                    autoCapitalize={field.autoCapitalize ?? 'words'}
                    maxLength={field.maxLength}
                    style={{
                      borderWidth: 1.5, borderColor: COLORS.border,
                      borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
                      fontSize: 16, color: COLORS.text, backgroundColor: COLORS.surface,
                    }}
                  />
                </View>
              ))}

              <TouchableOpacity
                onPress={handleSubmit}
                disabled={submitting}
                style={{
                  backgroundColor: COLORS.primary, borderRadius: 12,
                  paddingVertical: 16, alignItems: 'center', marginTop: 8,
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Registrarme como conductor</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
