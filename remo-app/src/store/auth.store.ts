import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

export type UserRole = 'passenger' | 'driver' | 'remisera_admin' | 'admin';

interface User {
  id: string;
  phone: string;
  name: string;
  role: UserRole;
  ratingAvg: number;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  setUser: (user: User) => void;
  setLoading: (v: boolean) => void;
  saveTokens: (access: string, refresh: string) => Promise<void>;
  clearSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,

  setUser: (user) => set({ user }),
  setLoading: (isLoading) => set({ isLoading }),

  saveTokens: async (access, refresh) => {
    await SecureStore.setItemAsync('accessToken', access);
    await SecureStore.setItemAsync('refreshToken', refresh);
  },

  clearSession: async () => {
    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('refreshToken');
    set({ user: null });
  },
}));
