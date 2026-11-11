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
}

export type ProfileInput = Partial<Omit<User, 'id' | 'username' | 'stats' | 'isPremium' | 'rating'>>;

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
