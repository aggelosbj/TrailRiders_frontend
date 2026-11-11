// ROUTE LIBRARY — the best roads shared by riders: search, filters, list / map, sort, favourites.
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { errorMessage } from '@/api/client';
import { getRoutesApi, LibRoute, ROUTE_DIFFICULTIES, ROUTE_STYLE_ICONS, ROUTE_STYLES, RouteSort, setRouteFavoriteApi } from '@/api/routesLibApi';
import { AppMap } from '@/components/kit/app-map';
import { showMessage } from '@/components/kit/dialogs';
import { EmptyState, IconButton, ScreenHeader } from '@/components/kit/layout';
import type { MapMarker } from '@/components/kit/map-types';
import { RouteCard } from '@/components/kit/route-ui';
import { Segmented } from '@/components/kit/segmented';
import { Brand, DIFFICULTY_COLORS, Radius, Shadow } from '@/constants/brand';
import { formatDistance } from '@/utils/geo';

const PAGE = 30;
type SortKey = RouteSort | 'favorites';

export default function RouteLibraryScreen() {
  const router = useRouter();
  const [view, setView] = useState<'list' | 'map'>('list');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('top');
  const [difficulty, setDifficulty] = useState('');
  const [style, setStyle] = useState('');
  const [routes, setRoutes] = useState<LibRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [more, setMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  const reqId = useRef(0);

  // debounce the search box
  useEffect(() => {
    const t = setTimeout(() => setSearch(query.trim()), 400);
    return () => clearTimeout(t);
  }, [query]);

  const filters = useMemo(
    () => ({
      search,
      difficulty,
      style,
      sort: (sort === 'favorites' ? 'new' : sort) as RouteSort,
      favorites: sort === 'favorites',
      ...(here ? { lat: here.lat, lng: here.lng } : {}),
      limit: PAGE,
    }),
    [search, difficulty, style, sort, here]
  );

  const load = useCallback(async () => {
    const id = ++reqId.current;
    try {
      const list = await getRoutesApi(filters);
      if (id !== reqId.current) return;
      setRoutes(list);
      setHasMore(list.length === PAGE);
      setError('');
    } catch (err) {
      if (id === reqId.current) setError(errorMessage(err));
    } finally {
      if (id === reqId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [filters]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const loadMore = async () => {
    if (more || !hasMore || loading) return;
    setMore(true);
    try {
      const list = await getRoutesApi({ ...filters, offset: routes.length });
      setRoutes((cur) => [...cur, ...list.filter((r) => !cur.some((c) => c.id === r.id))]);
      setHasMore(list.length === PAGE);
    } catch {
      setHasMore(false);
    } finally {
      setMore(false);
    }
  };

  const chooseSort = async (key: SortKey) => {
    if (key === sort) return;
    if (key === 'near' && !here) {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (!perm.granted) {
          showMessage('Location needed', 'Allow location access to find routes near you.');
          return;
        }
        const pos =
          (await Location.getLastKnownPositionAsync().catch(() => null)) ??
          (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
        setHere({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch {
        showMessage('Location unavailable', 'We could not get your position. Try again outdoors or check that location is on.');
        return;
      }
    }
    setLoading(true);
    setSort(key);
  };

  const toggleFavorite = async (r: LibRoute) => {
    const next = !r.isFavorite;
    const patch = (fav: boolean, count: number) =>
      setRoutes((cur) =>
        sort === 'favorites' && !fav ? cur.filter((x) => x.id !== r.id) : cur.map((x) => (x.id === r.id ? { ...x, isFavorite: fav, favoritesCount: count } : x))
      );
    patch(next, r.favoritesCount + (next ? 1 : -1));
    try {
      const res = await setRouteFavoriteApi(r.id, next);
      if (sort !== 'favorites') patch(res.isFavorite, res.favoritesCount);
    } catch (err) {
      showMessage('Could not update favourites', errorMessage(err));
      load();
    }
  };

  const markers = useMemo<MapMarker[]>(
    () =>
      routes
        .filter((r) => r.start)
        .map((r) => ({
          id: r.id,
          coordinate: r.start!,
          title: r.name,
          subtitle: `${r.ratingsCount ? `★ ${r.avgRating.toFixed(1)} · ` : ''}${formatDistance(r.distanceM)}${r.region ? ' · ' + r.region : ''}`,
          color: (r.difficulty && DIFFICULTY_COLORS[r.difficulty]?.fg) || Brand.primary,
        })),
    [routes]
  );

  const filtersActive = !!(difficulty || style || search);

  const header = (
    <View>
      {/* search */}
      <View style={styles.search}>
        <Ionicons name="search" size={18} color={Brand.faint} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search roads, regions, towns…"
          placeholderTextColor={Brand.faint}
          style={styles.searchInput}
          returnKeyType="search"
        />
        {!!query && (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={Brand.faint} />
          </Pressable>
        )}
      </View>

      {/* sort */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {(
          [
            { key: 'top', label: 'Top rated', icon: 'star' },
            { key: 'new', label: 'New', icon: 'sparkles' },
            { key: 'near', label: 'Near me', icon: 'locate' },
            { key: 'favorites', label: 'Favourites', icon: 'heart' },
          ] as { key: SortKey; label: string; icon: keyof typeof Ionicons.glyphMap }[]
        ).map((o) => {
          const on = sort === o.key;
          return (
            <Pressable key={o.key} style={[styles.sortChip, on && styles.sortChipOn]} onPress={() => chooseSort(o.key)}>
              <Ionicons name={o.icon} size={14} color={on ? '#fff' : Brand.navy} />
              <Text style={[styles.sortText, on && { color: '#fff' }]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {ROUTE_DIFFICULTIES.map((d) => {
          const on = difficulty === d;
          const c = DIFFICULTY_COLORS[d];
          return (
            <Pressable
              key={d}
              style={[styles.filterChip, on && { backgroundColor: c.fg, borderColor: c.fg }]}
              onPress={() => {
                setLoading(true);
                setDifficulty(on ? '' : d);
              }}
            >
              <View style={[styles.diffDot, { backgroundColor: on ? '#fff' : c.fg }]} />
              <Text style={[styles.filterText, on && { color: '#fff' }]}>{d}</Text>
            </Pressable>
          );
        })}
        <View style={styles.sep} />
        {ROUTE_STYLES.map((s) => {
          const on = style === s;
          return (
            <Pressable
              key={s}
              style={[styles.filterChip, on && { backgroundColor: Brand.primary, borderColor: Brand.primary }]}
              onPress={() => {
                setLoading(true);
                setStyle(on ? '' : s);
              }}
            >
              <Ionicons name={ROUTE_STYLE_ICONS[s]} size={13} color={on ? '#fff' : Brand.textSoft} />
              <Text style={[styles.filterText, on && { color: '#fff' }]}>{s}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={{ marginTop: 12, marginBottom: 14 }}>
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { key: 'list', label: 'List', icon: 'list' },
            { key: 'map', label: 'Map', icon: 'map' },
          ]}
        />
      </View>

      {!!error && (
        <View style={styles.error}>
          <Ionicons name="cloud-offline-outline" size={18} color={Brand.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );

  const empty = loading ? (
    <ActivityIndicator color={Brand.primary} style={{ marginTop: 40 }} />
  ) : error ? undefined : sort === 'favorites' ? (
    <EmptyState icon="heart-outline" title="No favourites yet" message="Tap the heart on a route to save it here for your next ride." />
  ) : (
    <EmptyState
      icon="map-outline"
      title={filtersActive ? 'No routes match' : 'No routes yet'}
      message={filtersActive ? 'Try another search or clear the filters.' : 'Record a great ride and publish it — be the first to share a road!'}
      actionLabel={filtersActive ? 'Clear filters' : 'Record a ride'}
      onAction={() => {
        if (filtersActive) {
          setQuery('');
          setSearch('');
          setDifficulty('');
          setStyle('');
        } else router.push('/track/record');
      }}
    />
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Route library"
        right={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <IconButton name="analytics-outline" onPress={() => router.push('/track')} />
            <IconButton name="add" onPress={() => router.push('/routes/new')} />
          </View>
        }
      />
      {view === 'list' ? (
        <FlatList
          data={loading ? [] : routes}
          keyExtractor={(r) => String(r.id)}
          renderItem={({ item }) => <RouteCard route={item} onPress={() => router.push(`/routes/${item.id}`)} onToggleFavorite={() => toggleFavorite(item)} />}
          ListHeaderComponent={header}
          ListEmptyComponent={empty}
          ListFooterComponent={more ? <ActivityIndicator color={Brand.primary} style={{ marginVertical: 16 }} /> : undefined}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={Brand.primary}
            />
          }
        />
      ) : (
        <View style={{ flex: 1, paddingHorizontal: 16 }}>
          <ScrollView style={{ flexGrow: 0 }} keyboardShouldPersistTaps="handled" scrollEnabled={false}>
            {header}
          </ScrollView>
          <View style={styles.mapWrap}>
            <AppMap markers={markers} height="100%" onMarkerPress={(id) => router.push(`/routes/${id}`)} />
            {loading && (
              <View style={styles.mapLoading}>
                <ActivityIndicator color={Brand.primary} />
              </View>
            )}
            {!loading && !markers.length && (
              <View style={styles.mapEmpty}>
                <Text style={styles.mapEmptyText}>No routes to show on the map</Text>
              </View>
            )}
            {!!markers.length && (
              <View style={styles.mapCount}>
                <Text style={styles.mapCountText}>
                  {markers.length} {markers.length === 1 ? 'route' : 'routes'} · tap a pin
                </Text>
              </View>
            )}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Brand.background },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    minHeight: 50,
    marginTop: 4,
    ...Shadow,
  },
  searchInput: { flex: 1, fontSize: 15, color: Brand.text, paddingVertical: 12, outlineStyle: 'none' } as object,
  chipRow: { gap: 8, paddingTop: 12, paddingRight: 8 },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Brand.navySoft,
    borderRadius: Radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  sortChipOn: { backgroundColor: Brand.navy },
  sortText: { fontSize: 13, fontWeight: '800', color: Brand.navy },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: Brand.border,
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filterText: { fontSize: 13, fontWeight: '700', color: Brand.textSoft },
  diffDot: { width: 8, height: 8, borderRadius: 4 },
  sep: { width: 1, backgroundColor: Brand.border, marginHorizontal: 2 },
  error: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Brand.dangerSoft, borderRadius: Radius.md, padding: 12, marginBottom: 12 },
  errorText: { flex: 1, color: Brand.danger, fontSize: 13, fontWeight: '600' },
  mapWrap: { flex: 1, marginBottom: 16, borderRadius: Radius.lg, overflow: 'hidden', ...Shadow },
  mapLoading: { position: 'absolute', top: 12, alignSelf: 'center', backgroundColor: '#fff', borderRadius: 20, padding: 8, ...Shadow },
  mapEmpty: { position: 'absolute', top: 12, alignSelf: 'center', backgroundColor: '#fff', borderRadius: Radius.pill, paddingHorizontal: 14, paddingVertical: 8, ...Shadow },
  mapEmptyText: { fontSize: 13, fontWeight: '700', color: Brand.textSoft },
  mapCount: { position: 'absolute', bottom: 12, alignSelf: 'center', backgroundColor: Brand.navy, borderRadius: Radius.pill, paddingHorizontal: 14, paddingVertical: 7 },
  mapCountText: { color: '#fff', fontSize: 12, fontWeight: '800' },
});
