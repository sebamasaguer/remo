import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { requestOtp } from '@/api/auth';
import { COLORS } from '@/constants';

export default function LoginScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    const cleaned = phone.trim();
    if (cleaned.length < 10) {
      Alert.alert('Teléfono inválido', 'Ingresá tu número completo con código de área.');
      return;
    }

    // Normaliza al formato +549XXXXXXXX
    const formatted = cleaned.startsWith('+') ? cleaned : `+549${cleaned.replace(/^0/, '')}`;

    setLoading(true);
    try {
      await requestOtp(formatted);
      router.push({ pathname: '/(auth)/verify', params: { phone: formatted } });
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message ?? 'No se pudo enviar el código.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: COLORS.white }}
    >
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 32 }}>
        {/* Logo */}
        <View style={{ alignItems: 'center', marginBottom: 48 }}>
          <View
            style={{
              width: 80, height: 80, borderRadius: 24,
              backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <Text style={{ fontSize: 36 }}>🚗</Text>
          </View>
          <Text style={{ fontSize: 32, fontWeight: '800', color: COLORS.primary }}>REMO</Text>
          <Text style={{ fontSize: 14, color: COLORS.muted, marginTop: 4 }}>
            Remises y taxis de Salta
          </Text>
        </View>

        {/* Form */}
        <Text style={{ fontSize: 22, fontWeight: '700', color: COLORS.text, marginBottom: 8 }}>
          Ingresá tu número
        </Text>
        <Text style={{ fontSize: 14, color: COLORS.textLight, marginBottom: 24 }}>
          Te enviamos un código por SMS para verificar tu identidad.
        </Text>

        <View
          style={{
            flexDirection: 'row', alignItems: 'center',
            borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12,
            paddingHorizontal: 16, paddingVertical: 14, marginBottom: 16,
            backgroundColor: COLORS.surface,
          }}
        >
          <Text style={{ fontSize: 16, color: COLORS.textLight, marginRight: 8 }}>🇦🇷 +549</Text>
          <TextInput
            style={{ flex: 1, fontSize: 18, color: COLORS.text }}
            placeholder="3874 000 000"
            placeholderTextColor={COLORS.muted}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            maxLength={15}
          />
        </View>

        <TouchableOpacity
          onPress={handleContinue}
          disabled={loading}
          style={{
            backgroundColor: COLORS.primary, borderRadius: 12,
            paddingVertical: 16, alignItems: 'center',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Continuar</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
