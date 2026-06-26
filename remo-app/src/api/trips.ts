import api from './client';

export interface TripEstimate {
  estimatedDistanceKm: number;
  estimatedDurationMin: number;
  estimatedPrice: number;
}

export interface Trip {
  id: string;
  status: string;
  originAddress: string;
  destinationAddress: string;
  estimatedPrice: number;
  finalPrice: number;
  paymentMethod: string;
  driver?: {
    id: string;
    user: { name: string; ratingAvg: number; avatarUrl: string };
    vehicle: { plate: string; brand: string; model: string; color: string };
  };
  createdAt: string;
}

export const estimateTrip = (
  originLat: number, originLng: number,
  destLat: number, destLng: number,
  originAddress: string, destAddress: string,
  paymentMethod: 'cash' | 'mercado_pago',
) =>
  api.post<TripEstimate>('/trips/estimate', {
    originLat, originLng, destinationLat: destLat, destinationLng: destLng,
    originAddress, destinationAddress, paymentMethod,
  });

export const createTrip = (body: {
  originLat: number; originLng: number;
  destinationLat: number; destinationLng: number;
  originAddress: string; destinationAddress: string;
  paymentMethod: 'cash' | 'mercado_pago';
}) => api.post<Trip>('/trips', body);

export const cancelTrip = (tripId: string) =>
  api.patch(`/trips/${tripId}/cancel`);

export const getMyTrips = (page = 1) =>
  api.get<{ items: Trip[]; total: number }>('/trips/my', { params: { page } });

export const getTrip = (tripId: string) =>
  api.get<Trip>(`/trips/${tripId}`);
