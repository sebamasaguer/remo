import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { verifyOtp, requestOtp } from '@/api/auth';
import { useAuthStore } from '@/store/auth.store';
import { COLORS } from '@/constants';

const CODE_LENGTH = 6;

export default function VerifyScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const router = useRouter();
  const { setUser, saveTokens } = useAuthStore();

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(30);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const timer = setInterval(() => {
      setResendSeconds((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleVerify = async (value: string) => {
    if (value.length < CODE_LENGTH) return;
    setLoading(true);
    try {
      const { data } = await verifyOtp(phone, value);
      await saveTokens(data.accessToken, data.refreshToken);
      setUser({ ...data.user, ratingAvg: 5 });

      if (data.user.role === 'driver') {
        router.replace('/(driver)');
      } else {
        router.replace('/(passenger)');
      }
    } catch (e: any) {
      Alert.alert('Código incorrecto', e.response?.data?.message ?? 'Intentá de nuevo.');
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendSeconds > 0) return;
    try {
      await requestOtp(phone);
      setResendSeconds(30);
      Alert.alert('Código reenviado', 'Revisá tus SMS.');
    } catch {
      Alert.alert('Error', 'No se pudo reenviar el código.');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: COLORS.white }}
    >
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 32 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 32 }}>
          <Text style={{ fontSize: 24 }}>←</Text>
        </TouchableOpacity>

        <Text style={{ fontSize: 26, fontWeight: '800', color: COLORS.text, marginBottom: 8 }}>
          Verificá tu número
        </Text>
        <Text style={{ fontSize: 14, color: COLORS.textLight, marginBottom: 40 }}>
          Ingresá el código de 6 dígitos enviado a{'\n'}
          <Text style={{ fontWeight: '700', color: COLORS.text }}>{phone}</Text>
        </Text>

        {/* Código visual — toque abre teclado */}
        <TouchableOpacity activeOpacity={1} onPress={() => inputRef.current?.focus()}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 40 }}>
            {Array.from({ length: CODE_LENGTH }).map((_, i) => (
              <View
                key={i}
                style={{
                  width: 48, height: 56, borderRadius: 12,
                  borderWidth: 2,
                  borderColor: i === code.length ? COLORS.primary : COLORS.border,
                  backgroundColor: COLORS.surface,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 24, fontWeight: '700', color: COLORS.text }}>
                  {code[i] ?? ''}
                </Text>
              </View>
            ))}
          </View>
        </TouchableOpacity>

        {/* Input oculto */}
        <TextInput
          ref={inputRef}
          value={code}
          onChangeText={(v) => {
            const digits = v.replace(/\D/g, '').slice(0, CODE_LENGTH);
            setCode(digits);
            if (digits.length === CODE_LENGTH) handleVerify(digits);
          }}
          keyboardType="number-pad"
          maxLength={CODE_LENGTH}
          autoFocus
          caretHidden
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
        />

        {loading && <ActivityIndicator color={COLORS.primary} style={{ marginBottom: 16 }} />}

        <TouchableOpacity onPress={handleResend} disabled={resendSeconds > 0}>
          <Text style={{ textAlign: 'center', color: resendSeconds > 0 ? COLORS.muted : COLORS.primary, fontSize: 14 }}>
            {resendSeconds > 0
              ? `Reenviar código en ${resendSeconds}s`
              : 'Reenviar código'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
