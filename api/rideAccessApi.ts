// Private rides (access code) + ride coordinates. Extends the types in ridesApi.ts.
import { api } from './client';
import type { Ride, RideInput } from './ridesApi';

export type RideVisibility = 'public' | 'private';

export interface RideAccessFields {
  visibility?: RideVisibility;
  /** only sent to the organizer of a private ride */
  accessCode?: string | null;
  /** private ride and you are not a participant: details are hidden */
  locked?: boolean;
}

export type AccessRide = Ride & RideAccessFields;

/** What RideForm submits: the normal ride fields + visibility + optional coordinates */
export type RideFormData = RideInput & {
  visibility?: RideVisibility;
  startLat?: number | null;
  startLng?: number | null;
  endLat?: number | null;
  endLng?: number | null;
};

export const isPrivateRide = (ride: Partial<Ride>) => (ride as RideAccessFields).visibility === 'private';
export const isLockedRide = (ride: Partial<Ride>) => !!(ride as RideAccessFields).locked;
export const rideAccessCode = (ride: Partial<Ride>) => (ride as RideAccessFields).accessCode ?? null;

/** Keeps only letters/digits, upper-case (what the server compares) */
export const cleanAccessCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Join a ride; `code` is required for private rides. Errors: CODE_REQUIRED / WRONG_CODE (403), TOO_MANY_ATTEMPTS (429) */
export async function joinRideWithCodeApi(rideId: number, code?: string) {
  const res = await api.post('/rides/joinRide', { rideId, ...(code ? { code: cleanAccessCode(code) } : {}) });
  return res.data;
}

/** Organizer only: replace the access code (the old one stops working) */
export async function regenerateRideCodeApi(rideId: number): Promise<{ accessCode: string }> {
  const res = await api.post(`/rides/${rideId}/regenerateCode`);
  return res.data;
}
