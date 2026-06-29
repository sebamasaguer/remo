import api from './client';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export interface DriverProfile {
  id: string;
  approvalStatus: ApprovalStatus;
  type: 'independent' | 'remisera';
  rejectionReason?: string;
  vehicle: { plate: string; brand: string; model: string; year: number; color: string };
}

export const registerDriver = (data: {
  type: 'independent' | 'remisera';
  remiseraId?: string;
  plate: string;
  brand: string;
  model: string;
  year: string;
  color: string;
}) => api.post<DriverProfile>('/drivers/register', data);

export const getRemiseras = () =>
  api.get<{ id: string; name: string }[]>('/remiseras');

export const getDriverProfile = () =>
  api.get<DriverProfile>('/drivers/me');

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
