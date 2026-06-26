import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '@/store/auth.store';
import { getMe } from '@/api/auth';
import '../global.css';

export default function RootLayout() {
  const { user, isLoading, setUser, setLoading } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    (async () => {
      try {
        const token = await SecureStore.getItemAsync('accessToken');
        if (token) {
          const { data } = await getMe();
          setUser({ ...data, ratingAvg: data.ratingAvg ?? 5 });
        }
      } catch {
        // token expirado o inválido — se limpia en el interceptor
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const inAuth = segments[0] === '(auth)';

    if (!user && !inAuth) {
      router.replace('/(auth)/login');
    } else if (user && inAuth) {
      if (user.role === 'driver') {
        router.replace('/(driver)');
      } else {
        router.replace('/(passenger)');
      }
    }
  }, [user, isLoading, segments]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
    </GestureHandlerRootView>
  );
}
