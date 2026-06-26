import api from './client';

export const requestOtp = (phone: string) =>
  api.post('/auth/request-otp', { phone });

export const verifyOtp = (phone: string, code: string) =>
  api.post<{
    accessToken: string;
    refreshToken: string;
    user: { id: string; phone: string; name: string; role: string };
    isNewUser: boolean;
  }>('/auth/verify-otp', { phone, code });

export const logout = () => api.post('/auth/logout');

export const getMe = () =>
  api.get<{ id: string; phone: string; name: string; role: string; ratingAvg: number }>('/users/me');
