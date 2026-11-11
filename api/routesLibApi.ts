import type { Ionicons } from '@expo/vector-icons';

import type { LatLng } from '@/components/kit/map-types';
import { api } from './client';

export const ROUTE_DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
export const ROUTE_STYLES = ['Twisties', 'Scenic', 'Mountain', 'Coastal', 'Offroad', 'City'];
export const ROUTE_SURFACES = ['Paved', 'Mixed', 'Gravel', 'Dirt'];

export const ROUTE_STYLE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Twisties: 'git-branch-outline',
  Scenic: 'camera-outline',
  Mountain: 'triangle-outline',
  Coastal: 'water-outline',
  Offroad: 'trail-sign-outline',
  City: 'business-outline',
};

export interface RouteAuthor {
  id: number;
  username: string;
  fullName?: string | null;
  image?: string | null;
  subscribed?: boolean;
}

export interface LibRoute {
  id: number;
  userId: number;
  name: string;
  description: string;
  region: string | null;
  difficulty: string | null;
  surface: string | null;
  style: string | null;
  distanceM: number;
  durationSec: number | null;
  elevationGainM: number | null;
  start: LatLng | null;
  end: LatLng | null;
  startName: string | null;
  endName: string | null;
  image: string | null;
  trackId: number | null;
  createdAt: string;
  avgRating: number;
  ratingsCount: number;
  favoritesCount: number;
  isFavorite: boolean;
  author: RouteAuthor;
  /** km from the position sent with sort=near */
  distanceKm?: number;
  /** ~48 [lat, lng] points for thumbnails */
  preview?: [number, number][];
}

export interface RouteRating {
  userId: number;
  rating: number;
  review: string | null;
  createdAt: string;
  user: RouteAuthor;
}

export interface LibRouteDetail extends LibRoute {
  /** [lat, lng, altitude|null] */
  points: [number, number, number | null][];
  isOwner: boolean;
  myRating: { rating: number; review: string | null } | null;
  ratings: RouteRating[];
}

export type RouteSort = 'top' | 'new' | 'near';

export interface RouteFilters {
  search?: string;
  difficulty?: string;
  style?: string;
  surface?: string;
  sort?: RouteSort;
  lat?: number;
  lng?: number;
  maxKm?: number;
  favorites?: boolean;
  mine?: boolean;
  userId?: number;
  limit?: number;
  offset?: number;
}

export interface RouteInput {
  name: string;
  description?: string;
  region?: string;
  difficulty?: string | null;
  style?: string | null;
  surface?: string | null;
  image?: string | null;
  startName?: string | null;
  endName?: string | null;
  /** publish one of my recordings… */
  trackId?: number;
  /** …or a raw path */
  points?: [number, number, number | null][];
}

export async function getRoutesApi(f: RouteFilters = {}): Promise<LibRoute[]> {
  const params: Record<string, string | number> = {};
  if (f.search?.trim()) params.search = f.search.trim();
  if (f.difficulty) params.difficulty = f.difficulty;
  if (f.style) params.style = f.style;
  if (f.surface) params.surface = f.surface;
  if (f.sort) params.sort = f.sort;
  if (f.lat !== undefined && f.lng !== undefined) {
    params.lat = f.lat;
    params.lng = f.lng;
  }
  if (f.maxKm) params.maxKm = f.maxKm;
  if (f.favorites) params.favorites = '1';
  if (f.mine) params.mine = '1';
  if (f.userId) params.userId = f.userId;
  if (f.limit) params.limit = f.limit;
  if (f.offset) params.offset = f.offset;
  return (await api.get('/library', { params })).data;
}

export async function getFavoriteRoutesApi(): Promise<LibRoute[]> {
  return (await api.get('/library/favorites')).data;
}

export async function getRouteApi(id: number | string): Promise<LibRouteDetail> {
  return (await api.get(`/library/${id}`)).data;
}

export async function createRouteApi(data: RouteInput): Promise<LibRoute> {
  return (await api.post('/library', data, { timeout: 60000 })).data;
}

export async function updateRouteApi(id: number, data: Partial<RouteInput>): Promise<LibRoute> {
  return (await api.put(`/library/${id}`, data, { timeout: 60000 })).data;
}

export async function deleteRouteApi(id: number) {
  return (await api.delete(`/library/${id}`)).data;
}

export async function rateRouteApi(id: number, rating: number, review?: string): Promise<{ avgRating: number; ratingsCount: number; message: string }> {
  return (await api.post(`/library/${id}/rate`, { rating, review })).data;
}

export async function removeRouteRatingApi(id: number) {
  return (await api.delete(`/library/${id}/rate`)).data;
}

export async function setRouteFavoriteApi(id: number, favorite: boolean): Promise<{ isFavorite: boolean; favoritesCount: number }> {
  return (favorite ? await api.post(`/library/${id}/favorite`) : await api.delete(`/library/${id}/favorite`)).data;
}

/** Rough riding time when the author didn't record one (50 km/h touring pace) */
export function estimatedDurationSec(r: Pick<LibRoute, 'durationSec' | 'distanceM'>) {
  return r.durationSec && r.durationSec > 0 ? r.durationSec : Math.round(r.distanceM / (50 / 3.6));
}
