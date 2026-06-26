import api from './client';

export const updateLocation = (lat: number, lng: number) =>
  api.post('/drivers/me/location', { lat, lng });

export const setOnlineStatus = (isOnline: boolean) =>
  api.patch('/drivers/me/status', { isOnline });

export const getEarnings = (period: 'day' | 'week' | 'month' = 'day') =>
  api.get<{
    period: string;
    totalTrips: number;
    totalEarnings: number;
    trips: any[];
  }>('/drivers/me/earnings', { params: { period } });

export const completeTrip = (tripId: string) =>
  api.patch(`/trips/${tripId}/complete`);

export const driverArrived = (tripId: string) =>
  api.patch(`/trips/${tripId}/driver-arrived`);

export const startTrip = (tripId: string) =>
  api.patch(`/trips/${tripId}/start`);
