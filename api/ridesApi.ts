import { api } from './client';

export interface RideUser {
  id: number;
  username: string;
  fullName?: string | null;
  image?: string | null;
  bike?: string | null;
  subscribed?: number | boolean;
}

export interface Ride {
  id: number;
  creatorId: number;
  organizer: string;
  title: string;
  image?: string | null;
  rideDistance?: number | null;
  startLocation: string;
  finishLocation: string;
  date: string;
  rideTime?: string | null;
  status: string;
  category?: string;
  description?: string;
  stops: string[];
  difficulty?: string;
  rideType?: string;
  expectedTime?: string | null;
  startLat?: number | null;
  startLng?: number | null;
  endLat?: number | null;
  endLng?: number | null;
  participants: string[];
  participantsCount: number;
  participantsInfo?: RideUser[];
  creator?: RideUser | null;
  ratings?: Rating[];
  ratingsCount?: number;
  avgRating?: number | null;
}

export interface Rating {
  id: number;
  userId: number;
  rating: number;
  review?: string | null;
  createdAt: string;
  username?: string;
  fullName?: string | null;
  image?: string | null;
}

export interface RideInput {
  title: string;
  startLocation: string;
  finishLocation: string;
  date: string;
  rideTime?: string;
  description?: string;
  stops?: string[];
  difficulty?: string;
  rideType?: string;
  category?: string;
  rideDistance?: number | null;
  expectedTime?: string;
  image?: string | null;
}

export interface Comment {
  id: number;
  rideId: number;
  userId: number;
  text: string;
  createdAt: string;
  username?: string;
  fullName?: string | null;
  image?: string | null;
}

export interface RideFilters {
  search?: string;
  difficulty?: string;
  rideType?: string;
  category?: string;
  upcoming?: boolean;
}

export async function getAllRidesApi(filters: RideFilters = {}): Promise<Ride[]> {
  const params: Record<string, string> = {};
  if (filters.search) params.search = filters.search;
  if (filters.difficulty) params.difficulty = filters.difficulty;
  if (filters.rideType) params.rideType = filters.rideType;
  if (filters.category) params.category = filters.category;
  if (filters.upcoming) params.upcoming = '1';
  const res = await api.get('/rides/getAllRides', { params });
  return res.data;
}

export async function getRideById(id: string | number): Promise<Ride> {
  const res = await api.get(`/rides/get/${id}`);
  return res.data;
}

export async function getMyRidesApi(): Promise<{ created: Ride[]; joined: Ride[] }> {
  const res = await api.get('/rides/myRides');
  return res.data;
}

export async function createRideApi(ride: RideInput): Promise<{ rideId: number }> {
  const res = await api.post('/rides/createRide', ride);
  return res.data;
}

export async function updateRideApi(id: number, ride: Partial<RideInput>) {
  const res = await api.put(`/rides/update/${id}`, ride);
  return res.data;
}

export async function deleteRideApi(id: number) {
  const res = await api.delete(`/rides/delete/${id}`);
  return res.data;
}

export async function joinRideApi(rideId: number) {
  const res = await api.post('/rides/joinRide', { rideId });
  return res.data;
}

export async function leaveRideApi(rideId: number) {
  const res = await api.post('/rides/leaveRide', { rideId });
  return res.data;
}

export async function getCommentsApi(rideId: number): Promise<Comment[]> {
  const res = await api.get(`/rides/${rideId}/comments`);
  return res.data;
}

export async function addCommentApi(rideId: number, text: string): Promise<Comment> {
  const res = await api.post(`/rides/${rideId}/comments`, { text });
  return res.data;
}

export async function deleteCommentApi(commentId: number) {
  const res = await api.delete(`/rides/comments/${commentId}`);
  return res.data;
}

export async function rateRideApi(rideId: number, rating: number, review?: string) {
  const res = await api.post(`/rides/${rideId}/rate`, { rating, review });
  return res.data;
}

// ---------- helpers ----------

/** Image for a ride: base64/URL from the DB, or the app logo */
export function imageSource(image?: string | null) {
  if (image && (image.startsWith('data:') || image.startsWith('http') || image.startsWith('file:') || image.startsWith('blob:'))) {
    return { uri: image };
  }
  return require('@/images/logo.webp');
}

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const isPastRide = (ride: Pick<Ride, 'date'>) => !!ride.date && ride.date < todayISO();

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "2025-12-10" -> "Wed, 10 Dec 2025" */
export function formatDate(date?: string | null, withWeekday = true) {
  if (!date) return 'Date TBA';
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return date;
  const dt = new Date(y, m - 1, d);
  return `${withWeekday ? DAYS[dt.getDay()] + ', ' : ''}${d} ${MONTHS[m - 1]} ${y}`;
}

export function dateParts(date?: string | null) {
  if (!date) return { day: '--', month: 'TBA' };
  const [, m, d] = date.slice(0, 10).split('-').map(Number);
  return { day: String(d || '--'), month: MONTHS[(m || 1) - 1].toUpperCase() };
}

/** "2026-11-11 18:48:19" -> "5 min ago" / "11 Nov" */
export function timeAgo(dateTime: string) {
  const t = new Date(dateTime.replace(' ', 'T') + (dateTime.endsWith('Z') ? '' : 'Z')).getTime();
  if (Number.isNaN(t)) return dateTime;
  const diff = Math.max(0, (Date.now() - t) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)} d ago`;
  const d = new Date(t);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** Opens the route in Google Maps (coordinates if available, otherwise place names) */
export function mapsUrl(ride: Ride) {
  const origin = ride.startLat && ride.startLng ? `${ride.startLat},${ride.startLng}` : ride.startLocation;
  const destination = ride.endLat && ride.endLng ? `${ride.endLat},${ride.endLng}` : ride.finishLocation;
  const waypoints = (ride.stops || []).filter(Boolean).join('|');
  return (
    'https://www.google.com/maps/dir/?api=1' +
    `&origin=${encodeURIComponent(origin)}` +
    `&destination=${encodeURIComponent(destination)}` +
    (waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : '') +
    '&travelmode=driving'
  );
}
