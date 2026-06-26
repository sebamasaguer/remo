import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { COLORS } from '@/constants';

export default function DriverLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.muted,
        tabBarStyle: { borderTopColor: COLORS.border },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Inicio', tabBarIcon: () => <Text style={{ fontSize: 20 }}>🚗</Text> }}
      />
      <Tabs.Screen
        name="earnings"
        options={{ title: 'Ganancias', tabBarIcon: () => <Text style={{ fontSize: 20 }}>💰</Text> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Perfil', tabBarIcon: () => <Text style={{ fontSize: 20 }}>👤</Text> }}
      />
    </Tabs>
  );
}
