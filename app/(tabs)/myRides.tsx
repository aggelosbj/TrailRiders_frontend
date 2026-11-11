import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { errorMessage } from '@/api/client';
import { EventItem, getMyEventsApi } from '@/api/eventsApi';
import { getMyPassengerRidesApi, PassengerRide } from '@/api/passengerRidesApi';
import { getMyRidesApi, isPastRide, Ride, todayISO } from '@/api/ridesApi';
import { EmptyState, Loading } from '@/components/kit/layout';
import { EventCard, ShareCard } from '@/components/kit/more-cards';
import { RideCard } from '@/components/kit/ride-cards';
import { Segmented } from '@/components/kit/segmented';
import { Brand, Radius } from '@/constants/brand';
import { useAuth } from '@/context/AuthContext';

type Tab = 'joined' | 'organizing' | 'shares' | 'events' | 'past';

export default function MyRidesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ tab?: Tab }>();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>(params.tab ?? 'joined');
  const [rides, setRides] = useState<{ created: Ride[]; joined: Ride[] }>({ created: [], joined: [] });
  const [shares, setShares] = useState<{ offered: PassengerRide[]; requested: PassengerRide[] }>({ offered: [], requested: [] });
  const [events, setEvents] = useState<{ organizing: EventItem[]; attending: EventItem[] }>({ organizing: [], attending: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [prevTab, setPrevTab] = useState(params.tab);
  if (params.tab !== prevTab) {
    setPrevTab(params.tab);
    if (params.tab) setTab(params.tab);
  }

  const load = useCallback(async () => {
    try {
      const [r, s, e] = await Promise.all([getMyRidesApi(), getMyPassengerRidesApi(), getMyEventsApi()]);
      setRides(r);
      setShares(s);
      setEvents(e);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const today = todayISO();
  const lists = useMemo(() => {
    const upcoming = <T extends { date?: string | null; eventDate?: string | null }>(x: T) => {
      const d = x.date ?? x.eventDate;
      return !d || d >= today;
    };
    return {
      joined: rides.joined.filter((r) => !isPastRide(r)),
      organizing: rides.created.filter((r) => !isPastRide(r)),
      shares: [...shares.offered, ...shares.requested].filter(upcoming).sort((a, b) => (a.date || '').localeCompare(b.date || '')),
      events: [...events.organizing, ...events.attending].filter(upcoming).sort((a, b) => (a.eventDate || '').localeCompare(b.eventDate || '')),
      past: [...rides.created, ...rides.joined].filter(isPastRide).sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    };
  }, [rides, shares, events, today]);

  const me = String(user?.id ?? '');

  const EMPTY: Record<Tab, { icon: 'people-outline' | 'flag-outline' | 'car-outline' | 'calendar-outline' | 'time-outline'; title: string; message: string; action?: string; go?: () => void }> = {
    joined: { icon: 'people-outline', title: 'No joined rides', message: 'Explore rides and join one — it will show up here.', action: 'Explore rides', go: () => router.push('/(tabs)/joinRide') },
    organizing: { icon: 'flag-outline', title: 'You are not organizing any ride', message: 'Create a ride and invite other riders.', action: 'Create a ride', go: () => router.push('/(tabs)/createRide') },
    shares: { icon: 'car-outline', title: 'No shared trips', message: 'Offer a free seat or request one from another rider.', action: 'Browse ride share', go: () => router.push({ pathname: '/(tabs)/joinRide', params: { tab: 'shares' } }) },
    events: { icon: 'calendar-outline', title: 'No upcoming events', message: 'Find a meetup or create your own event.', action: 'Browse events', go: () => router.push({ pathname: '/(tabs)/joinRide', params: { tab: 'events' } }) },
    past: { icon: 'time-outline', title: 'No ride history yet', message: 'Rides you complete will be listed here — and you can rate them.' },
  };

  const renderList = () => {
    if (tab === 'shares') {
      return lists.shares.map((r) => (
        <ShareCard
          key={`s${r.id}`}
          ride={r}
          tag={r.creatorId === user?.id ? 'Driver' : r.selected.includes(me) ? 'Confirmed' : 'Requested'}
          onPress={() => router.push(`/passengerRide/${r.id}`)}
        />
      ));
    }
    if (tab === 'events') {
      return lists.events.map((e) => (
        <EventCard key={`e${e.id}`} event={e} tag={e.ownerId === user?.id ? 'Organizer' : 'Going ✓'} onPress={() => router.push(`/event/${e.id}`)} />
      ));
    }
    return (lists[tab] as Ride[]).map((r) => (
      <RideCard
        key={`r${r.id}`}
        ride={r}
        onPress={() => router.push(`/rideDetails/${r.id}`)}
        tag={tab === 'past' ? (rides.created.some((c) => c.id === r.id) ? 'Organized' : 'Rate it ⭐') : undefined}
      />
    ));
  };

  const empty = EMPTY[tab];

  return (
    <View style={{ flex: 1, backgroundColor: Brand.background, paddingTop: insets.top + 8 }}>
      <View style={{ paddingHorizontal: 20 }}>
        <Text style={styles.title}>My activity</Text>
        <Text style={styles.subtitle}>Rides, shared trips and events — all in one place.</Text>
        <Segmented<Tab>
          scroll
          value={tab}
          onChange={setTab}
          options={[
            { key: 'joined', label: 'Joined', count: lists.joined.length },
            { key: 'organizing', label: 'Organizing', count: lists.organizing.length },
            { key: 'shares', label: 'Ride share', count: lists.shares.length },
            { key: 'events', label: 'Events', count: lists.events.length },
            { key: 'past', label: 'History', count: lists.past.length },
          ]}
        />
      </View>

      {loading ? (
        <Loading />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Brand.primary} />}
        >
          {error && (
            <Pressable style={styles.errorBox} onPress={load}>
              <Text style={styles.errorText}>{error} Tap to retry.</Text>
            </Pressable>
          )}
          {lists[tab].length === 0 ? (
            <EmptyState icon={empty.icon} title={empty.title} message={empty.message} actionLabel={empty.action} onAction={empty.go} />
          ) : (
            renderList()
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '900', color: Brand.text },
  subtitle: { fontSize: 14, color: Brand.muted, marginTop: 2, marginBottom: 16 },
  errorBox: { backgroundColor: Brand.dangerSoft, padding: 12, borderRadius: Radius.md, marginBottom: 12 },
  errorText: { color: Brand.danger, fontWeight: '600', fontSize: 13 },
});
