import type { MaterialCommunityIcons } from '@expo/vector-icons';
import type { AxiosError } from 'axios';

import { api } from './client';

// ---------------- Constants ----------------

export type ListingCategory = 'Motorcycle' | 'Car' | 'Helmet' | 'Clothing' | 'Parts' | 'Accessories' | 'Other';
export type ListingCondition = 'New' | 'Like new' | 'Used' | 'For parts';
export type ListingStatus = 'active' | 'reserved' | 'sold';
export type ListingSort = 'new' | 'price_asc' | 'price_desc';

type McIcon = keyof typeof MaterialCommunityIcons.glyphMap;

export const LISTING_CATEGORIES: { key: ListingCategory; label: string; icon: McIcon; color: string }[] = [
  { key: 'Motorcycle', label: 'Motorcycles', icon: 'motorbike', color: '#1DA1FA' },
  { key: 'Car', label: 'Cars', icon: 'car-sports', color: '#003366' },
  { key: 'Helmet', label: 'Helmets', icon: 'racing-helmet', color: '#FA881D' },
  { key: 'Clothing', label: 'Clothing', icon: 'tshirt-crew', color: '#8B5CF6' },
  { key: 'Parts', label: 'Parts', icon: 'cog', color: '#0EA5A4' },
  { key: 'Accessories', label: 'Accessories', icon: 'bag-personal', color: '#2E9E44' },
  { key: 'Other', label: 'Other', icon: 'dots-horizontal-circle-outline', color: '#6B7280' },
];

export const LISTING_CONDITIONS: ListingCondition[] = ['New', 'Like new', 'Used', 'For parts'];
export const VEHICLE_CATEGORIES: ListingCategory[] = ['Motorcycle', 'Car'];
export const MAX_LISTING_IMAGES = 8;

export const SORT_OPTIONS: { key: ListingSort; label: string }[] = [
  { key: 'new', label: 'Newest' },
  { key: 'price_asc', label: 'Price: low to high' },
  { key: 'price_desc', label: 'Price: high to low' },
];

export const STATUS_META: Record<ListingStatus, { label: string; bg: string; fg: string }> = {
  active: { label: 'Active', bg: '#E7F6EA', fg: '#2E9E44' },
  reserved: { label: 'Reserved', bg: '#FEF3C7', fg: '#B45309' },
  sold: { label: 'Sold', bg: '#E8EEF5', fg: '#003366' },
};

export const categoryMeta = (key?: string | null) => LISTING_CATEGORIES.find((c) => c.key === key) ?? LISTING_CATEGORIES[LISTING_CATEGORIES.length - 1];
export const isVehicle = (category?: string | null) => VEHICLE_CATEGORIES.includes(category as ListingCategory);

// ---------------- Types ----------------

export interface ListingSeller {
  id: number;
  username: string;
  fullName: string | null;
  isPremium: boolean;
  image?: string | null;
  bike?: string | null;
  location?: string | null;
  memberSince?: string | null;
  activeListings?: number;
  soldListings?: number;
}

export interface Listing {
  id: number;
  userId: number;
  title: string;
  category: ListingCategory;
  price: number | null;
  negotiable: boolean;
  condition: ListingCondition | null;
  brand: string | null;
  model: string | null;
  year: number | null;
  km: number | null;
  location: string | null;
  status: ListingStatus;
  isFeatured: boolean;
  featuredUntil: string | null;
  featuredHoursLeft: number;
  views: number;
  createdAt: string;
  updatedAt: string;
  /** first photo (thumbnail) */
  image: string | null;
  imagesCount: number;
  isFavorite: boolean;
  seller: ListingSeller;
  favoritesCount?: number;
}

export interface ListingDetail extends Listing {
  images: string[];
  description: string;
  isOwner: boolean;
  favoritesCount: number;
  moreFromSeller: Listing[];
}

export interface ListingInput {
  title: string;
  category: ListingCategory;
  price: number | null;
  negotiable: boolean;
  condition: ListingCondition | null;
  brand: string | null;
  model: string | null;
  year: number | null;
  km: number | null;
  location: string | null;
  description: string;
  images: string[];
}

export interface ListingFilters {
  q?: string;
  category?: ListingCategory | '';
  minPrice?: number | null;
  maxPrice?: number | null;
  condition?: ListingCondition | '';
  location?: string;
  sort?: ListingSort;
  featured?: boolean;
  excludeFeatured?: boolean;
  sellerId?: number;
  cursor?: string | null;
  limit?: number;
}

export interface ListingPage {
  items: Listing[];
  nextCursor: string | null;
  total: number;
}

export interface MyListingLimits {
  isPremium: boolean;
  active: number;
  maxActive: number | null;
  featured: number;
  maxFeatured: number;
  featureDays: number;
}

// ---------------- API ----------------

export async function getListingsApi(filters: ListingFilters = {}): Promise<ListingPage> {
  const params: Record<string, string | number> = {};
  if (filters.q) params.q = filters.q;
  if (filters.category) params.category = filters.category;
  if (filters.minPrice !== undefined && filters.minPrice !== null) params.minPrice = filters.minPrice;
  if (filters.maxPrice !== undefined && filters.maxPrice !== null) params.maxPrice = filters.maxPrice;
  if (filters.condition) params.condition = filters.condition;
  if (filters.location) params.location = filters.location;
  if (filters.sort && filters.sort !== 'new') params.sort = filters.sort;
  if (filters.featured) params.featured = 1;
  if (filters.excludeFeatured) params.excludeFeatured = 1;
  if (filters.sellerId) params.sellerId = filters.sellerId;
  if (filters.cursor) params.cursor = filters.cursor;
  if (filters.limit) params.limit = filters.limit;
  return (await api.get('/listings', { params })).data;
}

export async function getListingApi(id: number | string): Promise<ListingDetail> {
  return (await api.get(`/listings/${id}`)).data;
}

export async function getMyListingsApi(): Promise<{ items: Listing[]; limits: MyListingLimits }> {
  return (await api.get('/listings/mine')).data;
}

export async function getSavedListingsApi(): Promise<Listing[]> {
  return (await api.get('/listings/favorites')).data.items;
}

export async function createListingApi(data: ListingInput): Promise<{ listingId: number; listing: ListingDetail }> {
  return (await api.post('/listings', data, { timeout: 60000 })).data;
}

export async function updateListingApi(id: number, data: Partial<ListingInput>): Promise<ListingDetail> {
  return (await api.put(`/listings/${id}`, data, { timeout: 60000 })).data.listing;
}

export async function deleteListingApi(id: number) {
  return (await api.delete(`/listings/${id}`)).data;
}

export async function setListingStatusApi(id: number, status: ListingStatus): Promise<ListingDetail> {
  return (await api.patch(`/listings/${id}/status`, { status })).data.listing;
}

export async function featureListingApi(id: number): Promise<ListingDetail> {
  return (await api.post(`/listings/${id}/feature`)).data.listing;
}

export async function unfeatureListingApi(id: number): Promise<ListingDetail> {
  return (await api.delete(`/listings/${id}/feature`)).data.listing;
}

export async function setFavoriteApi(id: number, favorite: boolean): Promise<boolean> {
  const res = favorite ? await api.post(`/listings/${id}/favorite`) : await api.delete(`/listings/${id}/favorite`);
  return !!res.data.isFavorite;
}

/** Machine-readable error code from the backend, e.g. PREMIUM_LIMIT, PREMIUM_REQUIRED, FEATURE_LIMIT */
export function errorCode(err: unknown): string | undefined {
  return (err as AxiosError<{ code?: string }>)?.response?.data?.code;
}

// ---------------- Formatting ----------------

function groupThousands(n: number) {
  return String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** 4500 -> "€4,500", 12.5 -> "€12.50", null -> "Ask for price" */
export function formatPrice(price: number | null | undefined, askLabel = 'Ask for price') {
  if (price === null || price === undefined) return askLabel;
  if (price === 0) return 'Free';
  const cents = Math.round((price % 1) * 100);
  return `€${groupThousands(price)}${cents ? `.${String(cents).padStart(2, '0')}` : ''}`;
}

export const formatKm = (km?: number | null) => (km === null || km === undefined ? '' : `${groupThousands(km)} km`);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2025-03-14 10:00:00" -> "Mar 2025" */
export function monthYear(date?: string | null) {
  if (!date) return '';
  const m = /^(\d{4})-(\d{2})/.exec(date);
  return m ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : '';
}

/** Short spec line for cards: "2021 · 18,500 km" or "Like new" */
export function specLine(l: Pick<Listing, 'category' | 'year' | 'km' | 'condition' | 'brand'>) {
  if (isVehicle(l.category)) {
    const parts = [l.year ? String(l.year) : '', formatKm(l.km)].filter(Boolean);
    if (parts.length) return parts.join(' · ');
  }
  return [l.brand, l.condition].filter(Boolean).join(' · ');
}
