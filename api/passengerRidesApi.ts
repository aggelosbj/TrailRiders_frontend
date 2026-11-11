import { api } from './client';
import type { RideUser } from './ridesApi';

/** "Ride share": a rider/driver offers free seats, others request one and the owner accepts. */
export interface PassengerRide {
  id: number;
  creatorId: number;
  organizer: string;
  title: string;
  description: string;
  difficulty?: string;
  rideType?: string;
  startLocation: string;
  finishLocation: string;
  rideDistance?: number | null;
  rideTime?: string | null;
  stops: string[];
  image?: string | null;
  status?: string;
  date: string | null;
  seats: number;
  seatsLeft: number;
  requests: string[];
  selected: string[];
  creator?: RideUser | null;
  requestsInfo?: (RideUser & { accepted: boolean })[];
}

export interface PassengerRideInput {
  title: string;
  startLocation: string;
  finishLocation: string;
  date: string;
  rideTime?: string;
  description?: string;
  rideType?: string;
  seats: number;
  rideDistance?: number | null;
  stops?: string[];
  image?: string | null;
}

export async function getPassengerRidesApi(params: { upcoming?: boolean; search?: string } = {}): Promise<PassengerRide[]> {
  const res = await api.get('/passengerRides/getAllPRides', {
    params: { ...(params.upcoming ? { upcoming: '1' } : {}), ...(params.search ? { search: params.search } : {}) },
  });
  return res.data;
}

export async function getPassengerRideApi(id: number | string): Promise<PassengerRide> {
  const res = await api.get(`/passengerRides/getPRide/${id}`);
  return res.data;
}

export async function getMyPassengerRidesApi(): Promise<{ offered: PassengerRide[]; requested: PassengerRide[] }> {
  const res = await api.get('/passengerRides/my');
  return res.data;
}

export async function createPassengerRideApi(data: PassengerRideInput): Promise<{ rideId: number }> {
  const res = await api.post('/passengerRides/createPRide', data);
  return res.data;
}

export async function updatePassengerRideApi(id: number, data: Partial<PassengerRideInput>) {
  const res = await api.put(`/passengerRides/update/${id}`, data);
  return res.data;
}

export async function deletePassengerRideApi(id: number) {
  const res = await api.delete(`/passengerRides/delete/${id}`);
  return res.data;
}

export async function requestSeatApi(rideId: number) {
  const res = await api.post('/passengerRides/joinPRide', { rideId });
  return res.data;
}

export async function cancelSeatRequestApi(rideId: number) {
  const res = await api.post('/passengerRides/cancelRequest', { rideId });
  return res.data;
}

export async function selectPassengerApi(rideId: number, userId: number, accept: boolean) {
  const res = await api.post('/passengerRides/selectPassenger', { rideId, userId, accept });
  return res.data;
}
