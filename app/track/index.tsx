// MY RECORDINGS — totals + list of recorded rides, with a big "Start recording" button.
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { errorMessage } from '@/api/client';
import { getTracksApi, TrackSummary, TrackTotals } from '@/api/tracksApi';
import { EmptyState, IconButton, Loading, ScreenHeader } from '@/components/kit/layout';
import { TrackRow } from '@/components/kit/track-ui';
import { Brand, Radius, Shadow } from '@/constants/brand';
import { formatDistance } from '@/utils/geo';
import { loadRecording } from '@/utils/track-recorder';

export default function MyRecordingsScreen() {
  const router = useRouter();
  const [tracks, setTracks] = useState<TrackSummary[]>([]);
  const [totals, setTotals] = useState<TrackTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [unfinished, setUnfinished] = useState<{ distanceM: number } | null>(null);

  const load = useCallback(async () => {
    try {
      const [res, pending] = await Promise.all([getTracksApi(), loadRecording()]);
      setTracks(res.tracks);
      setTotals(res.totals);
      setUnfinished(pending && pending.points.length ? { distanceM: pending.distanceM } : null);
      setError('');
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

  if (loading) return <Loading />;

  const hours = (totals?.movingSec || totals?.durationSec || 0) / 3600;
  const km = (totals?.distanceM ?? 0) / 1000;

  const header = (
    <View>
      {/* Totals */}
      <View style={styles.hero}>
        <LinearGradient colors={[Brand.navy, '#0A5A9E', Brand.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <Ionicons name="analytics" size={150} color="rgba(255,255,255,0.07)" style={styles.heroIcon} />
        <Text style={styles.heroLabel}>Your riding</Text>
        <View style={styles.totals}>
          <Total value={String(totals?.count ?? 0)} label={totals?.count === 1 ? 'ride' : 'rides'} />
          <Total value={km >= 100 ? String(Math.round(km)) : km.toFixed(1)} label="km" />
          <Total value={hours >= 10 ? Math.round(hours).toString() : hours.toFixed(1)} label="hours" />
          <Total value={String(Math.round(totals?.maxSpeedKmh ?? 0))} label="top km/h" />
        </View>
      </View>

      {unfinished && (
        <Pressable style={styles.unfinished} onPress={() => router.push('/track/record')}>
          <View style={styles.pulse}>
            <Ionicons name="radio-button-on" size={18} color={Brand.danger} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.unfinishedTitle}>Unfinished ride · {formatDistance(unfinished.distanceM)}</Text>
            <Text style={styles.unfinishedText}>Tap to resume or save it</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Brand.danger} />
        </Pressable>
      )}

      <Pressable style={({ pressed }) => [styles.startBtn, pressed && { transform: [{ scale: 0.98 }] }]} onPress={() => router.push('/track/record')}>
        <View style={styles.startDot}>
          <View style={styles.startDotInner} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.startTitle}>Start recording</Text>
          <Text style={styles.startSub}>GPS track, speed, lean angle & G-force</Text>
        </View>
        <Ionicons name="chevron-forward" size={22} color="#fff" />
      </Pressable>

      <Pressable style={styles.libraryLink} onPress={() => router.push('/routes')}>
        <View style={styles.libraryIcon}>
          <Ionicons name="map" size={20} color={Brand.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.libraryTitle}>Route library</Text>
          <Text style={styles.librarySub}>Discover the best roads, shared by riders</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Brand.faint} />
      </Pressable>

      {!!error && (
        <View style={styles.error}>
          <Ionicons name="cloud-offline-outline" size={18} color={Brand.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {tracks.length > 0 && <Text style={styles.section}>Recorded rides</Text>}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="My recordings" right={<IconButton name="map-outline" onPress={() => router.push('/routes')} />} />
      <FlatList
        data={tracks}
        keyExtractor={(t) => String(t.id)}
        renderItem={({ item }) => <TrackRow track={item} onPress={() => router.push(`/track/${item.id}`)} />}
        ListHeaderComponent={header}
        ListEmptyComponent={
          !error ? (
            <EmptyState
              icon="navigate-circle-outline"
              title="No recordings yet"
              message="Record your next ride to see distance, top speed, lean angle and more — then share your favourite roads."
            />
          ) : undefined
        }
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
    </SafeAreaView>
  );
}

function Total({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={styles.totalValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.totalLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Brand.background },
  hero: { borderRadius: Radius.xl, padding: 18, overflow: 'hidden', marginTop: 4, ...Shadow },
  heroIcon: { position: 'absolute', right: -20, top: -10 },
  heroLabel: { color: 'rgba(255,255,255,0.8)', fontWeight: '800', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 },
  totals: { flexDirection: 'row', marginTop: 14 },
  totalValue: { color: '#fff', fontSize: 26, fontWeight: '900' },
  totalLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '700', marginTop: 1 },
  unfinished: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Brand.dangerSoft,
    borderRadius: Radius.lg,
    padding: 14,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#F8C9CB',
  },
  pulse: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  unfinishedTitle: { fontSize: 15, fontWeight: '800', color: Brand.danger },
  unfinishedText: { fontSize: 12, color: Brand.textSoft, marginTop: 1 },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Brand.danger,
    borderRadius: Radius.xl,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginTop: 14,
    ...Shadow,
  },
  startDot: { width: 46, height: 46, borderRadius: 23, borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
  startDotInner: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' },
  startTitle: { color: '#fff', fontSize: 19, fontWeight: '900' },
  startSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 2, fontWeight: '600' },
  libraryLink: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: Radius.lg, padding: 14, marginTop: 12, ...Shadow },
  libraryIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFF1E4', alignItems: 'center', justifyContent: 'center' },
  libraryTitle: { fontSize: 15, fontWeight: '800', color: Brand.text },
  librarySub: { fontSize: 12, color: Brand.muted, marginTop: 1 },
  error: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Brand.dangerSoft, borderRadius: Radius.md, padding: 12, marginTop: 12 },
  errorText: { flex: 1, color: Brand.danger, fontSize: 13, fontWeight: '600' },
  section: { fontSize: 18, fontWeight: '800', color: Brand.text, marginTop: 22, marginBottom: 12 },
});
