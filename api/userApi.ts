import { api } from './client';

export interface UserStats {
  created: number;
  joined: number;
  completed: number;
  km: number;
}

export interface User {
  id: number;
  username: string;
  email?: string | null;
  image?: string | null;
  fullName?: string | null;
  phone?: string | null;
  bike?: string | null;
  location?: string | null;
  bio?: string | null;
  tags?: string[];
  instagram?: string | null;
  facebook?: string | null;
  tiktok?: string | null;
  cover?: string | null;
  stats?: UserStats;
  isPremium?: boolean;
  rating?: { avg: number; count: number } | null;
  followers?: number;
  following?: number;
  /** only when viewing someone else's profile while logged in */
  isFollowing?: boolean;
  followsYou?: boolean;
  isBlocked?: boolean;
  blockedYou?: boolean;
  /** only on /api/me */
  canHost?: boolean;
  freeHostingLimit?: number;
  /** Emergency (ICE) info — only on /api/me and the updateProfile response, never on public profiles */
  bloodType?: BloodType | null;
  allergies?: string | null;
  medicalNotes?: string | null;
  emergencyName?: string | null;
  emergencyPhone?: string | null;
}

export const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
export type BloodType = (typeof BLOOD_TYPES)[number];

/** Limits enforced by the backend for the ICE fields */
export const ICE_LIMITS = { allergies: 255, medicalNotes: 500, emergencyName: 100, emergencyPhone: 30 } as const;

export type ProfileInput = Partial<Omit<User, 'id' | 'username' | 'stats' | 'isPremium' | 'rating' | 'followers' | 'following' | 'isFollowing' | 'followsYou' | 'isBlocked' | 'blockedYou' | 'canHost' | 'freeHostingLimit'>>;

export async function getMeApi(): Promise<User> {
  const res = await api.get('/api/me');
  return res.data;
}

export async function getUserApi(id: number | string): Promise<User> {
  const res = await api.get(`/api/user/${id}`);
  return res.data;
}

export async function updateProfileApi(profile: ProfileInput): Promise<User> {
  const res = await api.post('/api/user/updateProfile', profile);
  return res.data.user;
}
