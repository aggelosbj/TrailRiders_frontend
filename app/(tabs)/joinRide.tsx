import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { errorMessage } from '@/api/client';
import { EventItem, getEventsApi } from '@/api/eventsApi';
import { getPassengerRidesApi, PassengerRide } from '@/api/passengerRidesApi';
import { isLockedRide, isPrivateRide } from '@/api/rideAccessApi';
import { formatDate, getAllRidesApi, isPastRide, joinRideApi, Ride } from '@/api/ridesApi';
import { AppMap } from '@/components/kit/app-map';
import { showMessage } from '@/components/kit/dialogs';
import { EmptyState, Loading } from '@/components/kit/layout';
import { EventCard, ShareCard } from '@/components/kit/more-cards';
import type { MapMarker } from '@/components/kit/map-types';
import { PRIVATE_COLOR, RideCard } from '@/components/kit/ride-cards';
import { Segmented } from '@/components/kit/segmented';
import { Brand, DIFFICULTIES, Radius, RIDE_TYPES, Shadow } from '@/constants/brand';
import { useAuth } from '@/context/AuthContext';

type Tab = 'rides' | 'shares' | 'events';
type ViewMode = 'list' | 'map';
type Item = { kind: 'ride'; data: Ride } | { kind: 'share'; data: PassengerRide } | { kind: 'event'; data: EventItem };

export default function ExploreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ rideType?: string; tab?: Tab }>();
  const { user } = useAuth();
  const me = String(user?.id ?? '');

  const [tab, setTab] = useState<Tab>(params.tab ?? 'rides');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [rideType, setRideType] = useState(params.rideType ?? '');
  const [upcomingOnly, setUpcomingOnly] = useState(true);

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joiningId, setJoiningId] = useState<number | null>(null);
  const [view, setView] = useState<ViewMode>('list');
  const showMap = tab === 'rides' && view === 'map';

  // Rides with a known start point -> map pins (private rides in the "lock" colour)
  const rideMarkers = useMemo(() => {
    const markers: MapMarker[] = [];
    for (const it of items) {
      if (it.kind !== 'ride') continue;
      const r = it.data;
      if (r.startLat == null || r.startLng == null) continue;
      const priv = isPrivateRide(r);
      markers.push({
        id: r.id,
        coordinate: { latitude: Number(r.startLat), longitude: Number(r.startLng) },
        title: `${priv ? '🔒 ' : ''}${r.title}`,
        subtitle: `${formatDate(r.date)} · ${r.startLocation}`,
        color: priv ? PRIVATE_COLOR : isPastRide(r) ? Brand.faint : Brand.primary,
      });
    }
    return markers;
  }, [items]);
  const ridesWithoutPin = items.filter((it) => it.kind === 'ride').length - rideMarkers.length;

  const [prevParams, setPrevParams] = useState({ rideType: params.rideType, tab: params.tab });
  if (params.rideType !== prevParams.rideType || params.tab !== prevParams.tab) {
    setPrevParams({ rideType: params.rideType, tab: params.tab });
    if (params.rideType !== undefined && params.rideType !== prevParams.rideType) {
      setRideType(params.rideType);
      setTab('rides');
    } else if (params.tab) {
      setTab(params.tab);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchData = useCallback(async () => {
    try {
      if (tab === 'rides') {
        const data = await getAllRidesApi({ search: debounced, difficulty, rideType, upcoming: upcomingOnly });
        setItems(data.map((d) => ({ kind: 'ride', data: d })));
      } else if (tab === 'shares') {
        const data = await getPassengerRidesApi({ search: debounced, upcoming: upcomingOnly });
        setItems(data.map((d) => ({ kind: 'share', data: d })));
      } else {
        const data = await getEventsApi({ search: debounced, upcoming: upcomingOnly });
        setItems(data.map((d) => ({ kind: 'event', data: d })));
      }
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab, debounced, difficulty, rideType, upcomingOnly]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const switchTab = (t: Tab) => {
    if (t === tab) return;
    setItems([]);
    setLoading(true);
    setTab(t);
  };

  const handleJoin = async (ride: Ride) => {
    setJoiningId(ride.id);
    try {
      await joinRideApi(ride.id);
      setItems((list) =>
        list.map((it) =>
          it.kind === 'ride' && it.data.id === ride.id
            ? { kind: 'ride', data: { ...it.data, participants: [...it.data.participants, me], participantsCount: it.data.participantsCount + 1 } }
            : it
        )
      );
      showMessage('You are in! 🏍️', `You joined "${ride.title}".`);
    } catch (err) {
      showMessage('Could not join', errorMessage(err));
    } finally {
      setJoiningId(null);
    }
  };

  const rideAction = (ride: Ride) => {
    if (ride.creatorId === user?.id) return { label: 'Your ride', disabled: true, variant: 'soft' as const };
    if (ride.participants.includes(me)) return { label: 'Joined ✓', disabled: true, variant: 'soft' as const };
    if (isPastRide(ride)) return { label: 'Finished', disabled: true, variant: 'soft' as const };
    // private: the code is entered on the ride page
    if (isPrivateRide(ride) && isLockedRide(ride)) return { label: 'Enter code', disabled: false, variant: 'outline' as const };
    return { label: 'Join ride', disabled: false, variant: 'navy' as const };
  };

  const onRideAction = (ride: Ride) => {
    if (isPrivateRide(ride) && isLockedRide(ride)) {
      router.push({ pathname: '/rideDetails/[id]', params: { id: String(ride.id), code: '1' } });
      return;
    }
    handleJoin(ride);
  };

  const activeFilters = [difficulty, rideType].filter(Boolean).length + (upcomingOnly ? 0 : 1);
  const noun = tab === 'rides' ? 'ride' : tab === 'shares' ? 'trip' : 'event';

  const empty = {
    rides: { icon: 'compass-outline' as const, title: 'No rides match', message: 'Try a different search or clear the filters — or create your own ride.', label: 'Create a ride', type: 'ride' },
    shares: { icon: 'car-outline' as const, title: 'No seats offered yet', message: 'Going somewhere with a free seat? Offer it to other riders.', label: 'Offer seats', type: 'share' },
    events: { icon: 'calendar-outline' as const, title: 'No upcoming events', message: 'Organise a meetup, a show or a track day.', label: 'Create an event', type: 'event' },
  }[tab];

  return (
    <View style={{ flex: 1, backgroundColor: Brand.background, paddingTop: insets.top + 8 }}>
      <View style={styles.top}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Explore</Text>
          {tab === 'rides' && (
            <View style={styles.viewToggle}>
              {(['list', 'map'] as const).map((v) => (
                <Pressable
                  key={v}
                  onPress={() => setView(v)}
                  style={[styles.viewBtn, view === v && styles.viewBtnActive]}
                  accessibilityRole="button"
                  accessibilityLabel={v === 'list' ? 'Show as list' : 'Show on map'}
                  accessibilityState={{ selected: view === v }}
                >
                  <Ionicons name={v === 'list' ? 'list' : 'map'} size={15} color={view === v ? '#fff' : Brand.muted} />
                  <Text style={[styles.viewBtnText, view === v && { color: '#fff' }]}>{v === 'list' ? 'List' : 'Map'}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
        <Text style={styles.subtitle}>Group rides, shared trips and events near you.</Text>

        <Segmented<Tab>
          value={tab}
          onChange={switchTab}
          options={[
            { key: 'rides', label: 'Rides', icon: 'bicycle' },
            { key: 'shares', label: 'Ride share', icon: 'car' },
            { key: 'events', label: 'Events', icon: 'calendar' },
          ]}
        />

        <View style={styles.search}>
          <Ionicons name="search" size={19} color={Brand.faint} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={tab === 'events' ? 'Search events or places' : 'Search by title, place or organizer'}
            placeholderTextColor={Brand.faint}
            style={styles.searchInput}
            autoCorrect={false}
          />
          {!!search && (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={19} color={Brand.faint} />
            </Pressable>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          <FilterChip label="Upcoming" active={upcomingOnly} onPress={() => setUpcomingOnly((v) => !v)} icon="time-outline" />
          {tab === 'rides' &&
            RIDE_TYPES.map((t) => <FilterChip key={t} label={t} active={rideType === t} onPress={() => setRideType(rideType === t ? '' : t)} />)}
          {tab === 'rides' &&
            DIFFICULTIES.map((d) => <FilterChip key={d} label={d} active={difficulty === d} onPress={() => setDifficulty(difficulty === d ? '' : d)} />)}
          {activeFilters > 0 && (
            <FilterChip
              label="Clear"
              icon="close"
              active={false}
              onPress={() => {
                setDifficulty('');
                setRideType('');
                setUpcomingOnly(true);
              }}
            />
          )}
        </ScrollView>
      </View>

      {loading ? (
        <Loading />
      ) : showMap ? (
        <View style={styles.mapWrap}>
          {error ? (
            <Pressable style={styles.errorBox} onPress={fetchData}>
              <Text style={styles.errorText}>{error} Tap to retry.</Text>
            </Pressable>
          ) : (
            <View style={styles.mapLegend}>
              <Legend color={Brand.primary} label="Public" />
              <Legend color={PRIVATE_COLOR} label="Private" />
              {!upcomingOnly && <Legend color={Brand.faint} label="Past" />}
              <Text style={styles.mapCount} numberOfLines={1}>
                {rideMarkers.length} on map{ridesWithoutPin > 0 ? ` · ${ridesWithoutPin} without location` : ''}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <AppMap
              markers={rideMarkers}
              height="100%"
              showsUserLocation
              onMarkerPress={(id) => router.push(`/rideDetails/${id}`)}
            />
            {rideMarkers.length === 0 && !error && (
              <View style={styles.mapEmpty} pointerEvents="none">
                <Text style={styles.mapEmptyText}>No rides with a location match these filters.</Text>
              </View>
            )}
          </View>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => `${it.kind}-${it.data.id}`}
          contentContainerStyle={{ padding: 20, paddingTop: 6, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={Brand.primary} />}
          ListHeaderComponent={
            error ? (
              <Pressable style={styles.errorBox} onPress={fetchData}>
                <Text style={styles.errorText}>{error} Tap to retry.</Text>
              </Pressable>
            ) : (
              <Text style={styles.count}>
                {items.length} {items.length === 1 ? noun : `${noun}s`} found
              </Text>
            )
          }
          ListEmptyComponent={
            !error ? (
              <EmptyState
                icon={empty.icon}
                title={empty.title}
                message={empty.message}
                actionLabel={empty.label}
                onAction={() => router.push({ pathname: '/(tabs)/createRide', params: { type: empty.type } })}
              />
            ) : undefined
          }
          renderItem={({ item }) => {
            if (item.kind === 'share') {
              const r = item.data;
              const tag = r.creatorId === user?.id ? 'Yours' : r.selected.includes(me) ? 'Confirmed' : r.requests.includes(me) ? 'Requested' : undefined;
              return <ShareCard ride={r} tag={tag} onPress={() => router.push(`/passengerRide/${r.id}`)} />;
            }
            if (item.kind === 'event') {
              const e = item.data;
              const tag = e.ownerId === user?.id ? 'Organizer' : e.attendees.includes(me) ? 'Going ✓' : undefined;
              return <EventCard event={e} tag={tag} onPress={() => router.push(`/event/${e.id}`)} />;
            }
            const action = rideAction(item.data);
            return (
              <RideCard
                ride={item.data}
                onPress={() => router.push(`/rideDetails/${item.data.id}`)}
                actionLabel={action.label}
                actionVariant={action.variant}
                actionDisabled={action.disabled}
                actionLoading={joiningId === item.data.id}
                onAction={() => onRideAction(item.data)}
              />
            );
          }}
        />
      )}
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function FilterChip({ label, active, onPress, icon }: { label: string; active: boolean; onPress: () => void; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      {icon && <Ionicons name={icon} size={14} color={active ? '#fff' : Brand.textSoft} style={{ marginRight: 4 }} />}
      <Text style={[styles.chipText, active && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: 20 },
  title: { fontSize: 28, fontWeight: '900', color: Brand.text },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  viewToggle: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: Radius.pill, padding: 3, ...Shadow },
  viewBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.pill },
  viewBtnActive: { backgroundColor: Brand.navy },
  viewBtnText: { fontSize: 12, fontWeight: '800', color: Brand.muted },
  mapWrap: { flex: 1, paddingHorizontal: 20, paddingBottom: 16 },
  mapLegend: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 10 },
  legendText: { fontSize: 12, fontWeight: '700', color: Brand.textSoft },
  mapCount: { marginLeft: 'auto', flexShrink: 1, fontSize: 12, color: Brand.muted, fontWeight: '600' },
  mapEmpty: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 16,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: Radius.md,
    padding: 12,
    ...Shadow,
  },
  mapEmptyText: { textAlign: 'center', color: Brand.textSoft, fontWeight: '600', fontSize: 13 },
  subtitle: { fontSize: 14, color: Brand.muted, marginTop: 2, marginBottom: 14 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    height: 50,
    marginTop: 12,
    ...Shadow,
  },
  searchInput: { flex: 1, minWidth: 0, marginLeft: 10, fontSize: 15, color: Brand.text, outlineStyle: 'none' } as object,
  filters: { paddingVertical: 14, gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: Brand.border,
  },
  chipActive: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  chipText: { fontWeight: '700', fontSize: 13, color: Brand.textSoft },
  count: { color: Brand.muted, fontWeight: '600', marginBottom: 10, fontSize: 13 },
  errorBox: { backgroundColor: Brand.dangerSoft, padding: 12, borderRadius: Radius.md, marginBottom: 12 },
  errorText: { color: Brand.danger, fontWeight: '600', fontSize: 13 },
});
