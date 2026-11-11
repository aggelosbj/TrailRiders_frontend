import { api } from './client';

/**
 * Compact GPS point: [lat, lng, tMs, speedKmh, altitude, seg?]
 *  - tMs: milliseconds since the recording started
 *  - seg: 1 when the point starts a new segment (first fix after a pause) — the gap isn't counted
 */
export type TrackPoint = [number, number, number, number | null, number | null, number?];

export interface TrackSummary {
  id: number;
  userId: number;
  title: string | null;
  startedAt: string; // "YYYY-MM-DD HH:MM:SS" (UTC)
  endedAt: string;
  durationSec: number;
  movingSec: number;
  distanceM: number;
  maxSpeedKmh: number;
  avgSpeedKmh: number;
  maxLeanLeft: number | null;
  maxLeanRight: number | null;
  maxGForce: number | null;
  avgGForce: number | null;
  elevationGainM: number | null;
  maxAltitudeM: number | null;
  minAltitudeM: number | null;
  startName: string | null;
  endName: string | null;
  rideId: number | null;
  createdAt: string;
}

export interface Track extends TrackSummary {
  points: TrackPoint[];
  /** id of the library route published from this recording, if any */
  routeId: number | null;
}

export interface TrackTotals {
  count: number;
  distanceM: number;
  durationSec: number;
  movingSec: number;
  maxSpeedKmh: number;
}

export interface TrackInput {
  title?: string;
  startedAt: string; // ISO
  endedAt?: string; // ISO
  durationSec: number;
  points: TrackPoint[];
  maxLeanLeft?: number | null;
  maxLeanRight?: number | null;
  maxGForce?: number | null;
  avgGForce?: number | null;
  startName?: string | null;
  endName?: string | null;
  rideId?: number | null;
}

export async function createTrackApi(data: TrackInput): Promise<TrackSummary> {
  return (await api.post('/tracks', data, { timeout: 60000 })).data;
}

export async function getTracksApi(): Promise<{ tracks: TrackSummary[]; totals: TrackTotals }> {
  return (await api.get('/tracks')).data;
}

export async function getTrackApi(id: number | string): Promise<Track> {
  return (await api.get(`/tracks/${id}`)).data;
}

export async function renameTrackApi(id: number, title: string): Promise<{ title: string }> {
  return (await api.patch(`/tracks/${id}`, { title })).data;
}

export async function deleteTrackApi(id: number) {
  return (await api.delete(`/tracks/${id}`)).data;
}

/** Server datetimes are UTC "YYYY-MM-DD HH:MM:SS" */
export function parseServerDate(s?: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s.replace(' ', 'T') + (s.endsWith('Z') ? '' : 'Z'));
  return Number.isNaN(d.getTime()) ? null : d;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Sat, 14 Jun 2026 · 09:42" in the phone's time zone */
export function formatTrackDate(s?: string | null, withTime = true) {
  const d = parseServerDate(s);
  if (!d) return '';
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}${withTime ? ' · ' + time : ''}`;
}

/** "Morning ride", "Evening ride"… based on the local start time */
export function defaultRideTitle(date: Date = new Date()) {
  const h = date.getHours();
  if (h >= 5 && h < 12) return 'Morning ride';
  if (h >= 12 && h < 17) return 'Afternoon ride';
  if (h >= 17 && h < 21) return 'Evening ride';
  return 'Night ride';
}
