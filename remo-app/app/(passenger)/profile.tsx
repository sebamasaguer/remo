import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { useAuthStore } from '@/store/auth.store';
import { logout } from '@/api/auth';
import { disconnectSocket } from '@/hooks/useSocket';
import { useRouter } from 'expo-router';
import { COLORS } from '@/constants';

export default function ProfileScreen() {
  const { user, clearSession } = useAuthStore();
  const router = useRouter();

  const handleLogout = async () => {
    Alert.alert('Cerrar sesión', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir', style: 'destructive', onPress: async () => {
          try { await logout(); } catch { }
          disconnectSocket();
          await clearSession();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.surface }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 56, paddingBottom: 24 }}>
        <Text style={{ fontSize: 24, fontWeight: '800', color: COLORS.text }}>Mi perfil</Text>
      </View>

      {/* Avatar */}
      <View style={{ alignItems: 'center', paddingVertical: 24 }}>
        <View style={{
          width: 88, height: 88, borderRadius: 44,
          backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
          marginBottom: 12,
        }}>
          <Text style={{ fontSize: 40 }}>👤</Text>
        </View>
        <Text style={{ fontSize: 20, fontWeight: '700', color: COLORS.text }}>
          {user?.name ?? 'Sin nombre'}
        </Text>
        <Text style={{ color: COLORS.textLight, marginTop: 4 }}>{user?.phone}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
          <Text style={{ color: COLORS.secondary, fontSize: 18 }}>⭐</Text>
          <Text style={{ fontWeight: '700', fontSize: 16, color: COLORS.text, marginLeft: 4 }}>
            {Number(user?.ratingAvg ?? 5).toFixed(1)}
          </Text>
        </View>
      </View>

      {/* Opciones */}
      <View style={{ marginHorizontal: 16, gap: 2 }}>
        {[
          { icon: '👤', label: 'Editar perfil' },
          { icon: '🔔', label: 'Notificaciones' },
          { icon: '🛡️', label: 'Contactos de emergencia' },
          { icon: '❓', label: 'Ayuda' },
        ].map((item) => (
          <TouchableOpacity
            key={item.label}
            style={{
              flexDirection: 'row', alignItems: 'center',
              backgroundColor: COLORS.white, padding: 16, borderRadius: 12,
              marginBottom: 8, borderWidth: 1, borderColor: COLORS.border,
            }}
          >
            <Text style={{ fontSize: 20, marginRight: 12 }}>{item.icon}</Text>
            <Text style={{ flex: 1, fontSize: 15, color: COLORS.text }}>{item.label}</Text>
            <Text style={{ color: COLORS.muted }}>›</Text>
          </TouchableOpacity>
        ))}

        {/* Registrarse como conductor */}
        <TouchableOpacity
          onPress={() => router.push('/(auth)/register-driver')}
          style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: '#EEF2FF', padding: 16, borderRadius: 12,
            marginTop: 8, borderWidth: 1.5, borderColor: COLORS.primary,
          }}
        >
          <Text style={{ fontSize: 20, marginRight: 12 }}>🚗</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, color: COLORS.primary, fontWeight: '700' }}>
              Quiero ser conductor
            </Text>
            <Text style={{ fontSize: 12, color: COLORS.textLight, marginTop: 2 }}>
              Registrá tu vehículo y empezá a ganar
            </Text>
          </View>
          <Text style={{ color: COLORS.primary }}>›</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        onPress={handleLogout}
        style={{
          marginHorizontal: 16, marginTop: 24, padding: 16,
          backgroundColor: '#FEF2F2', borderRadius: 12,
          borderWidth: 1, borderColor: '#FECACA', alignItems: 'center',
        }}
      >
        <Text style={{ color: COLORS.danger, fontWeight: '700', fontSize: 15 }}>Cerrar sesión</Text>
      </TouchableOpacity>
    </View>
  );
}
