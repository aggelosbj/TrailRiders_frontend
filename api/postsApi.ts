import type { Ionicons } from '@expo/vector-icons';

import { api } from './client';

export interface PostAuthor {
  id: number;
  username: string;
  fullName?: string | null;
  image?: string | null;
  subscribed?: boolean;
}

export interface Post {
  id: number;
  text: string;
  images: string[];
  category: PostCategory | null;
  location: string | null;
  createdAt: string;
  author: PostAuthor;
  likesCount: number;
  commentsCount: number;
  likedByMe: boolean;
  rideId: number | null;
  trackId: number | null;
}

export interface PostComment {
  id: number;
  postId: number;
  text: string;
  createdAt: string;
  author: PostAuthor;
}

export interface PostInput {
  text?: string;
  images?: string[];
  category?: PostCategory | null;
  location?: string;
  rideId?: number;
  trackId?: number;
}

export type FeedScope = 'all' | 'following';

export const POST_CATEGORIES = ['Sport', 'Naked', 'Adventure', 'Touring', 'Cruiser', 'Supermoto', 'Scooter', 'Classic', 'Car', 'Other'] as const;
export type PostCategory = (typeof POST_CATEGORIES)[number];

export const MAX_POST_IMAGES = 4;
export const MAX_POST_TEXT = 2000;
export const POSTS_PAGE = 20;

/** Icon + accent colour for every category chip */
export const CATEGORY_META: Record<PostCategory, { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
  Sport: { icon: 'speedometer', color: '#E5484D', bg: '#FDECEC' },
  Naked: { icon: 'flash', color: '#B45309', bg: '#FEF3C7' },
  Adventure: { icon: 'compass', color: '#2E9E44', bg: '#E7F6EA' },
  Touring: { icon: 'map', color: '#0B7FD1', bg: '#E6F4FE' },
  Cruiser: { icon: 'navigate', color: '#7C3AED', bg: '#F1EBFE' },
  Supermoto: { icon: 'trending-up', color: '#FA881D', bg: '#FFF1E3' },
  Scooter: { icon: 'bicycle', color: '#0EA5A4', bg: '#E2F7F6' },
  Classic: { icon: 'time', color: '#92400E', bg: '#F7EDE2' },
  Car: { icon: 'car-sport', color: '#003366', bg: '#E8EEF5' },
  Other: { icon: 'ellipsis-horizontal-circle', color: '#4B5563', bg: '#F1F2F4' },
};

export function categoryMeta(category?: string | null) {
  return category && category in CATEGORY_META ? CATEGORY_META[category as PostCategory] : null;
}

// ---------- feed ----------

export async function getPostsApi(params: { scope?: FeedScope; category?: string; before?: number; limit?: number } = {}): Promise<Post[]> {
  const query: Record<string, string | number> = { scope: params.scope ?? 'all', limit: params.limit ?? POSTS_PAGE };
  if (params.category) query.category = params.category;
  if (params.before) query.before = params.before;
  return (await api.get('/posts', { params: query })).data;
}

export async function getUserPostsApi(userId: number | string, before?: number, limit = POSTS_PAGE): Promise<Post[]> {
  return (await api.get(`/posts/user/${userId}`, { params: before ? { before, limit } : { limit } })).data;
}

export async function getPostApi(id: number | string): Promise<Post> {
  return (await api.get(`/posts/${id}`)).data;
}

export async function createPostApi(input: PostInput): Promise<Post> {
  return (await api.post('/posts', input, { timeout: 60000 })).data;
}

export async function deletePostApi(id: number) {
  return (await api.delete(`/posts/${id}`)).data;
}

// ---------- likes ----------

export async function likePostApi(id: number): Promise<{ liked: boolean; likesCount: number }> {
  return (await api.post(`/posts/${id}/like`)).data;
}

export async function unlikePostApi(id: number): Promise<{ liked: boolean; likesCount: number }> {
  return (await api.delete(`/posts/${id}/like`)).data;
}

// ---------- comments ----------

export async function getPostCommentsApi(id: number | string): Promise<PostComment[]> {
  return (await api.get(`/posts/${id}/comments`)).data;
}

export async function addPostCommentApi(id: number, text: string): Promise<PostComment> {
  return (await api.post(`/posts/${id}/comments`, { text })).data;
}

export async function deletePostCommentApi(commentId: number) {
  return (await api.delete(`/posts/comments/${commentId}`)).data;
}

// ---------- helpers ----------

/** Text used by the share button */
export function postShareText(post: Post) {
  const who = post.author.fullName || post.author.username;
  const body = post.text ? `“${post.text.length > 160 ? post.text.slice(0, 157) + '…' : post.text}”` : 'shared a photo';
  return `🏍️ ${who} on TrailRiders: ${body}${post.location ? `\n📍 ${post.location}` : ''}\n\nJoin the ride on TrailRiders!`;
}

/** "1234" -> "1.2k" */
export function compactCount(n: number) {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, '')}k`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
}
