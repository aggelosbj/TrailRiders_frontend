import { api } from './client';
import type { RideUser } from './ridesApi';
import type { Ride } from './ridesApi';

export interface Message {
  id: number;
  senderId: number;
  receiverId: number;
  text: string;
  readAt: string | null;
  createdAt: string;
}

export interface Conversation {
  user: RideUser;
  lastMessage: { id: number; text: string; senderId: number; createdAt: string };
  unread: number;
}

export type FollowUser = RideUser & { isFollowing: boolean };

// ---------- messages ----------
export async function getConversationsApi(): Promise<Conversation[]> {
  return (await api.get('/social/conversations')).data;
}

export async function getUnreadMessagesApi(): Promise<number> {
  return (await api.get('/social/messages/unreadCount')).data.count;
}

export async function getMessagesApi(userId: number | string, after?: number): Promise<{ user: RideUser | null; blocked: boolean; messages: Message[] }> {
  return (await api.get(`/social/messages/${userId}`, { params: after ? { after } : {} })).data;
}

export async function sendMessageApi(userId: number | string, text: string): Promise<Message> {
  return (await api.post(`/social/messages/${userId}`, { text })).data;
}

// ---------- follows ----------
export async function followApi(userId: number) {
  return (await api.post(`/social/follow/${userId}`)).data;
}

export async function unfollowApi(userId: number) {
  return (await api.delete(`/social/follow/${userId}`)).data;
}

export async function getFollowsApi(userId: number | string, type: 'followers' | 'following'): Promise<FollowUser[]> {
  return (await api.get(`/social/follows/${userId}`, { params: { type } })).data;
}

export async function getFeedApi(): Promise<{ rides: Ride[] }> {
  return (await api.get('/social/feed')).data;
}

// ---------- blocks & reports ----------
export async function blockUserApi(userId: number) {
  return (await api.post(`/social/block/${userId}`)).data;
}

export async function unblockUserApi(userId: number) {
  return (await api.delete(`/social/block/${userId}`)).data;
}

export async function getBlockedApi(): Promise<RideUser[]> {
  return (await api.get('/social/blocks')).data;
}

export type ReportTarget = 'user' | 'ride' | 'event' | 'passengerRide' | 'comment' | 'message';
export const REPORT_REASONS: { key: string; label: string }[] = [
  { key: 'spam', label: 'Spam or scam' },
  { key: 'harassment', label: 'Harassment or hate' },
  { key: 'inappropriate', label: 'Inappropriate content' },
  { key: 'fake', label: 'Fake profile or ride' },
  { key: 'dangerous', label: 'Dangerous / illegal riding' },
  { key: 'other', label: 'Something else' },
];

export async function reportApi(targetType: ReportTarget, targetId: number, reason: string, details?: string) {
  return (await api.post('/social/report', { targetType, targetId, reason, details })).data;
}
