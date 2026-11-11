// PUBLISH A ROUTE (from one of my recordings: ?trackId=) — or EDIT one of my routes (?id=)
import { Ionicons } from '@expo/vector-icons';
import { AxiosError } from 'axios';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { errorMessage } from '@/api/client';
import { createRouteApi, getRouteApi, ROUTE_DIFFICULTIES, ROUTE_STYLES, ROUTE_SURFACES, updateRouteApi } from '@/api/routesLibApi';
import { formatTrackDate, getTrackApi, getTracksApi, Track, TrackSummary } from '@/api/tracksApi';
import { AppMap } from '@/components/kit/app-map';
import { Button } from '@/components/kit/button';
import { showMessage } from '@/components/kit/dialogs';
import { ChipSelect, FormField } from '@/components/kit/form';
import { pickImage } from '@/components/kit/image-picker';
import { EmptyState, Loading, ScreenHeader } from '@/components/kit/layout';
import type { LatLng, MapMarker } from '@/components/kit/map-types';
import { Brand, Radius, Shadow } from '@/constants/brand';
import { formatDistance, formatDuration } from '@/utils/geo';

export default function PublishRouteScreen() {
  const params = useLocalSearchParams<{ trackId?: string; id?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const editId = params.id ? Number(params.id) : null;
  const [trackId, setTrackId] = useState<number | null>(params.trackId ? Number(params.trackId) : null);

  const [loading, setLoading] = useState(true);
  const [track, setTrack] = useState<Track | null>(null);
  const [myTracks, setMyTracks] = useState<TrackSummary[] | null>(null);
  const [path, setPath] = useState<LatLng[]>([]);
  const [stats, setStats] = useState<{ distanceM: number; durationSec: number | null; elevationGainM: number | null } | null>(null);

  const [name, setName] = useState('');
  const [region, setRegion] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [routeStyle, setRouteStyle] = useState('');
  const [surface, setSurface] = useState('Paved');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // load what we are publishing / editing
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (editId) {
          const r = await getRouteApi(editId);
          if (!alive) return;
          if (!r.isOwner) {
            showMessage('Not your route', 'You can only edit routes you published.');
            router.back();
            return;
          }
          setName(r.name);
          setRegion(r.region ?? '');
          setDifficulty(r.difficulty ?? '');
          setRouteStyle(r.style ?? '');
          setSurface(r.surface ?? '');
          setDescription(r.description ?? '');
          setImage(r.image);
          setPath(r.points.map((p) => ({ latitude: p[0], longitude: p[1] })));
          setStats({ distanceM: r.distanceM, durationSec: r.durationSec, elevationGainM: r.elevationGainM });
        } else if (trackId) {
          const t = await getTrackApi(trackId);
          if (!alive) return;
          if (t.routeId) {
            showMessage('Already published', 'This ride is already in the route library.');
            router.replace(`/routes/${t.routeId}`);
            return;
          }
          setTrack(t);
          setName((n) => n || (t.title && t.title !== 'My ride' ? t.title : ''));
          setRegion((r) => r || t.startName || '');
          setPath(t.points.map((p) => ({ latitude: p[0], longitude: p[1] })));
          setStats({ distanceM: t.distanceM, durationSec: t.movingSec || t.durationSec, elevationGainM: t.elevationGainM });
        } else {
          const res = await getTracksApi();
          if (!alive) return;
          setMyTracks(res.tracks.filter((t) => t.distanceM >= 500));
        }
      } catch (err) {
        if (alive) showMessage('Could not load', errorMessage(err));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [editId, trackId, router]);

  const lines = useMemo(() => (path.length > 1 ? [{ id: 'p', coordinates: path, color: Brand.primary, width: 5 }] : []), [path]);
  const markers = useMemo<MapMarker[]>(
    () =>
      path.length > 1
        ? [
            { id: 's', coordinate: path[0], color: Brand.success, label: 'S' },
            { id: 'f', coordinate: path[path.length - 1], color: Brand.danger, label: 'F' },
          ]
        : [],
    [path]
  );

  const chooseImage = async () => {
    const img = await pickImage([16, 9]);
    if (img) setImage(img);
  };

  const submit = async () => {
    const e: Record<string, string> = {};
    if (name.trim().length < 3) e.name = 'Give the road a name (at least 3 characters)';
    if (!difficulty) e.difficulty = 'Choose a difficulty';
    if (!routeStyle) e.style = 'Choose a riding style';
    setErrors(e);
    if (Object.keys(e).length) return;

    const data = {
      name: name.trim(),
      region: region.trim(),
      difficulty,
      style: routeStyle,
      surface: surface || null,
      description: description.trim(),
      image,
    };
    setSaving(true);
    try {
      if (editId) {
        await updateRouteApi(editId, data);
        router.back();
      } else if (trackId) {
        const r = await createRouteApi({ ...data, trackId });
        router.replace(`/routes/${r.id}`);
        showMessage('Route published! 🛣️', 'Thanks for sharing — other riders can now find, rate and ride it.');
      }
    } catch (err) {
      const existing = (err as AxiosError<{ routeId?: number }>)?.response?.data?.routeId;
      if (existing) router.replace(`/routes/${existing}`);
      else showMessage('Could not save', errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;

  // No track chosen yet: pick one of my recordings
  if (!editId && !trackId) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenHeader title="Publish a route" />
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <View style={styles.intro}>
            <Ionicons name="map" size={22} color={Brand.primary} />
            <Text style={styles.introText}>Routes in the library come from real rides. Choose one of your recordings to share it.</Text>
          </View>
          {!myTracks?.length ? (
            <EmptyState
              icon="navigate-circle-outline"
              title="No recordings yet"
              message="Record a ride with the app first (at least 500 m), then publish it here."
              actionLabel="Start recording"
              onAction={() => router.replace('/track/record')}
            />
          ) : (
            myTracks.map((t) => (
              <Pressable key={t.id} style={styles.pick} onPress={() => {
                setLoading(true);
                setTrackId(t.id);
              }}>
                <View style={styles.pickIcon}>
                  <Ionicons name="analytics" size={20} color={Brand.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.pickTitle} numberOfLines={1}>
                    {t.title || 'My ride'}
                  </Text>
                  <Text style={styles.pickSub} numberOfLines={1}>
                    {formatTrackDate(t.startedAt, false)} · {formatDistance(t.distanceM)} · {formatDuration(t.movingSec || t.durationSec)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Brand.faint} />
              </Pressable>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!editId && !track) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenHeader title="Publish a route" />
        <EmptyState icon="alert-circle-outline" title="Recording not found" message="It may have been deleted." actionLabel="My recordings" onAction={() => router.replace('/track')} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title={editId ? 'Edit route' : 'Publish route'} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
          {/* Preview */}
          <View style={styles.previewCard}>
            <AppMap lines={lines} markers={markers} height={190} interactive={false} style={{ borderRadius: 0 }} />
            {stats && (
              <View style={styles.previewStats}>
                <PreviewStat icon="navigate" value={formatDistance(stats.distanceM)} label="Distance" />
                <PreviewStat icon="time" value={stats.durationSec ? formatDuration(stats.durationSec) : '—'} label="Riding time" />
                <PreviewStat icon="trending-up" value={stats.elevationGainM !== null ? `${stats.elevationGainM} m` : '—'} label="Climb" />
              </View>
            )}
          </View>

          {/* Cover photo */}
          <Text style={styles.label}>Cover photo</Text>
          <Pressable style={styles.cover} onPress={chooseImage}>
            {image ? (
              <>
                <Image source={{ uri: image }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                <Pressable style={styles.removeImg} onPress={() => setImage(null)} hitSlop={8}>
                  <Ionicons name="close" size={16} color="#fff" />
                </Pressable>
              </>
            ) : (
              <View style={{ alignItems: 'center' }}>
                <Ionicons name="image-outline" size={30} color={Brand.primary} />
                <Text style={styles.coverText}>Add a photo of the road (optional)</Text>
              </View>
            )}
          </Pressable>

          <FormField label="Road name" icon="map-outline" value={name} onChangeText={setName} placeholder="e.g. Arachova – Delphi sweepers" maxLength={120} error={errors.name} />
          <FormField label="Region" icon="location-outline" value={region} onChangeText={setRegion} placeholder="e.g. Fokida, Peloponnese, Crete" maxLength={80} />
          <ChipSelect label="Difficulty" options={ROUTE_DIFFICULTIES} value={difficulty} onChange={setDifficulty} />
          {!!errors.difficulty && <Text style={styles.err}>{errors.difficulty}</Text>}
          <ChipSelect label="Riding style" options={ROUTE_STYLES} value={routeStyle} onChange={setRouteStyle} />
          {!!errors.style && <Text style={styles.err}>{errors.style}</Text>}
          <ChipSelect label="Surface" options={ROUTE_SURFACES} value={surface} onChange={setSurface} allowEmpty />
          <FormField
            label="Description"
            value={description}
            onChangeText={setDescription}
            placeholder="What makes this road great? Corners, views, road condition, where to stop for coffee…"
            multiline
            maxLength={2000}
            hint={`${description.length}/2000`}
          />
          {!editId && (
            <Text style={styles.privacy}>
              <Ionicons name="shield-checkmark-outline" size={12} color={Brand.muted} /> Only the path, distance, riding time and climb are shared — your speeds, lean angles and timestamps stay private.
            </Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <Button title={editId ? 'Save changes' : 'Publish to library'} icon={editId ? 'checkmark' : 'cloud-upload-outline'} onPress={submit} loading={saving} style={{ flex: 1 }} />
      </View>
    </SafeAreaView>
  );
}

function PreviewStat({ icon, value, label }: { icon: keyof typeof Ionicons.glyphMap; value: string; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Ionicons name={icon} size={16} color={Brand.primary} />
      <Text style={styles.psValue}>{value}</Text>
      <Text style={styles.psLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Brand.background },
  intro: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: Brand.primarySoft, borderRadius: Radius.md, padding: 14, marginBottom: 16 },
  introText: { flex: 1, color: Brand.primaryDark, fontSize: 14, fontWeight: '600', lineHeight: 20 },
  pick: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: Radius.lg, padding: 14, marginBottom: 10, ...Shadow },
  pickIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: Brand.primarySoft, alignItems: 'center', justifyContent: 'center' },
  pickTitle: { fontSize: 16, fontWeight: '800', color: Brand.text },
  pickSub: { fontSize: 12, color: Brand.muted, marginTop: 2 },
  previewCard: { backgroundColor: '#fff', borderRadius: Radius.lg, overflow: 'hidden', marginBottom: 18, ...Shadow },
  previewStats: { flexDirection: 'row', paddingVertical: 12 },
  psValue: { fontSize: 15, fontWeight: '900', color: Brand.text, marginTop: 4 },
  psLabel: { fontSize: 11, fontWeight: '700', color: Brand.muted, marginTop: 1 },
  label: { fontSize: 13, fontWeight: '700', color: Brand.textSoft, marginBottom: 7, letterSpacing: 0.2 },
  cover: {
    height: 160,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#B9DDF7',
    backgroundColor: Brand.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 16,
  },
  coverText: { color: Brand.primaryDark, fontWeight: '700', marginTop: 6, fontSize: 13 },
  removeImg: { position: 'absolute', top: 10, right: 10, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  err: { color: Brand.danger, fontSize: 12, marginTop: -10, marginBottom: 14, fontWeight: '500' },
  privacy: { fontSize: 12, color: Brand.muted, lineHeight: 17 },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    ...Shadow,
  },
});
