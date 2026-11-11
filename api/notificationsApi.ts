import { api } from './client';

export interface NotificationItem {
  id: number;
  userId: number;
  senderId?: number | null;
  senderName?: string | null;
  subject: string;
  description?: string | null;
  rideId?: number | null;
  /** in-app path, e.g. /event/3 */
  link?: string | null;
  isRead: boolean;
  createdAt: string;
}

export async function getNotificationsApi(): Promise<NotificationItem[]> {
  const res = await api.get('/api/notifications');
  return res.data;
}

export async function getUnreadCountApi(): Promise<number> {
  const res = await api.get('/api/notifications/unreadCount');
  return res.data.count;
}

export async function markNotificationsApi(ids: number[], isRead = true) {
  await api.post('/api/notifications/markRead', { ids, isRead });
}

export async function markAllReadApi() {
  await api.post('/api/notifications/markRead', { all: true, isRead: true });
}

export async function deleteNotificationsApi(ids: number[]) {
  await api.post('/api/notifications/delete', { ids });
}
