import { api } from './client';
import type { RideUser } from './ridesApi';

export interface EventItem {
  id: number;
  name: string;
  ownerId: number | null;
  description: string;
  eventDate: string | null;
  eventTime?: string | null;
  location: string;
  category?: string;
  image?: string | null;
  maxAttendees?: number | null;
  isCompany: boolean;
  companyName?: string | null;
  attendees: string[];
  attendeesCount: number;
  owner?: RideUser | null;
  attendeesInfo?: RideUser[];
}

export interface EventInput {
  name: string;
  eventDate: string;
  eventTime?: string;
  location: string;
  category?: string;
  description?: string;
  maxAttendees?: number | null;
  image?: string | null;
}

export const EVENT_CATEGORIES = ['Meetup', 'Show', 'Track Day', 'Workshop', 'Charity'];

export async function getEventsApi(params: { upcoming?: boolean; search?: string; category?: string } = {}): Promise<EventItem[]> {
  const res = await api.get('/event', {
    params: {
      ...(params.upcoming ? { upcoming: '1' } : {}),
      ...(params.search ? { search: params.search } : {}),
      ...(params.category ? { category: params.category } : {}),
    },
  });
  return res.data;
}

export async function getEventApi(id: number | string): Promise<EventItem> {
  const res = await api.get(`/event/${id}`);
  return res.data;
}

export async function getMyEventsApi(): Promise<{ organizing: EventItem[]; attending: EventItem[] }> {
  const res = await api.get('/event/my');
  return res.data;
}

export async function createEventApi(data: EventInput): Promise<{ eventId: number }> {
  const res = await api.post('/event/create', data);
  return res.data;
}

export async function updateEventApi(id: number, data: Partial<EventInput>) {
  const res = await api.put(`/event/${id}`, data);
  return res.data;
}

export async function deleteEventApi(id: number) {
  const res = await api.delete(`/event/${id}`);
  return res.data;
}

export async function rsvpEventApi(id: number, attend: boolean) {
  const res = await api.post(`/event/${id}/rsvp`, { attend });
  return res.data;
}
